import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { agentRuns, decisions, events, paperOrders, signals, tenantSettings } from "../db/schema";
import {
  placeBitgetPaperOrder,
  assertPaperOnlySettings,
  fetchBitgetMarkQuote,
} from "../integrations/bitget-paper";
import { scoreEventWithLlm } from "../integrations/llm";
import { ingestClosedMarketNews } from "../integrations/news";
import { isVigilError } from "../security/errors";
import { newId } from "../security/crypto";
import { evaluateClosedWindow } from "./closed-window";
import { evaluateFennGates, fixedPaperQuantity, parseAllowlist } from "./fenn";
import { sealWhyCard } from "./journal";
import {
  buildMemoryDigest,
  parseMovePctNumber,
  recordLesson,
} from "./memory";
import { assessRtokenSignal } from "./signal";
import { analysisCompleteForPaper } from "./trader-rubric";

export type PipelineResult = {
  runId: string;
  status: "completed" | "skipped" | "failed";
  windowState: string;
  summary: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
};

export async function runVigilPipeline(tenantId: string): Promise<PipelineResult> {
  const db = await getDb();
  const runId = newId("run");

  const settingsRows = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);
  const settings = settingsRows[0] ?? {
    weekendWatch: true,
    afterHoursWatch: true,
    paperOnly: true,
    maxPositionUsd: 5000,
    minConfidence: 70,
    llmDeclared: "undeclared",
    fennMode: true,
    allowlist: [] as string[],
    fixedPaperSize: 1,
  };

  assertPaperOnlySettings(settings.paperOnly !== false);

  const fennMode = settings.fennMode !== false;
  const allowlist = parseAllowlist(settings.allowlist ?? []);
  const fixedSize = fixedPaperQuantity(settings.fixedPaperSize ?? 1);

  const window = evaluateClosedWindow(new Date(), {
    weekendWatch: settings.weekendWatch,
    afterHoursWatch: settings.afterHoursWatch,
  });

  await db.insert(agentRuns).values({
    id: runId,
    tenantId,
    status: "running",
    windowState: window.state,
  });

  try {
    if (!window.allowed) {
      const summary = { gate: "closed-window", ...window };
      await finishRun(runId, "skipped", summary);
      return { runId, status: "skipped", windowState: window.state, summary };
    }

    const news = await ingestClosedMarketNews();
    let processed = 0;
    let papered = 0;
    let refused = 0;
    const artifacts: unknown[] = [];
    const paperedTickers = new Set<string>();
    const sidesByTicker = new Map<string, "buy" | "sell">();

    for (const item of news) {
      const eventId = newId("evt");
      await db.insert(events).values({
        id: eventId,
        tenantId,
        source: item.source,
        headline: item.headline,
        url: item.url,
        tickerHint: item.tickerHint,
        observedAt: new Date(item.observedAt),
        payload: item.raw,
        metricLabel: item.metricLabel,
      });

      const assessment = await assessRtokenSignal(item);
      const signalId = newId("sig");
      await db.insert(signals).values({
        id: signalId,
        tenantId,
        eventId,
        ticker: assessment.ticker,
        movePct: assessment.movePct,
        score: assessment.score,
        state: assessment.state,
        metricLabel: assessment.metricLabel,
        details: assessment.details,
      });

      const fenn = evaluateFennGates({
        fennMode,
        allowlist,
        ticker: assessment.ticker,
        paperedTickers,
        sidesByTicker,
      });

      // FENN: headline alone → NO why-card (journal is the product)
      if (!fenn.allowPaper) {
        const decisionId = newId("dec");
        await db.insert(decisions).values({
          id: decisionId,
          tenantId,
          signalId,
          action: "NO_TRADE",
          confidence: 100,
          llmProvider: "fenn-gate",
          llmModel: "deterministic",
          rationale: fenn.reason,
          metricLabel: "observed",
        });
        const sealed = await sealWhyCard(tenantId, decisionId, {
          eventId,
          signalId,
          decisionId,
          paperOrderId: null,
          headline: item.headline,
          ticker: assessment.ticker,
          action: "NO_TRADE",
          confidence: 100,
          windowState: window.state,
          llmProvider: "fenn-gate",
          llmModel: "deterministic",
          rationale: fenn.reason,
          metricLabels: {
            event: item.metricLabel,
            signal: assessment.metricLabel,
            decision: "observed",
          },
          gates: [
            "event-received",
            "closed-window-verified",
            "fenn-allowlist",
            fenn.gate,
            "no-paper-order",
            "why-card-sealed",
          ],
        });
        await recordLesson({
          tenantId,
          ticker: assessment.ticker,
          action: "NO_TRADE",
          gate: fenn.gate,
          movePct: parseMovePctNumber(assessment.movePct),
          score: assessment.score,
          outcome: "refused",
          summary: fenn.reason,
          tags: ["fenn", fenn.gate],
          source: "live",
          decisionId,
        });
        processed += 1;
        refused += 1;
        artifacts.push({
          eventId,
          signalId,
          decisionId,
          refused: true,
          gate: fenn.gate,
          why: sealed,
        });
        continue;
      }

      // Pre-LLM gate: only hard-reject Rejected. Watch/Review/Qualified may reach policy.
      // minConfidence applies after the LLM decides whether to paper.
      if (assessment.state === "Rejected") {
        const decisionId = newId("dec");
        const rationale = `Signal Rejected score=${assessment.score} (need Watch+) · move=${assessment.movePct}`;
        await db.insert(decisions).values({
          id: decisionId,
          tenantId,
          signalId,
          action: "NO_TRADE",
          confidence: assessment.score,
          llmProvider: "signal-gate",
          llmModel: "deterministic",
          rationale,
          metricLabel: assessment.metricLabel,
        });
        const sealed = await sealWhyCard(tenantId, decisionId, {
          eventId,
          signalId,
          decisionId,
          paperOrderId: null,
          headline: item.headline,
          ticker: assessment.ticker,
          action: "NO_TRADE",
          confidence: assessment.score,
          windowState: window.state,
          llmProvider: "signal-gate",
          llmModel: "deterministic",
          rationale,
          metricLabels: {
            event: item.metricLabel,
            signal: assessment.metricLabel,
            decision: assessment.metricLabel,
          },
          gates: [
            "event-received",
            "closed-window-verified",
            "allowlist-pass",
            "signal-rejected",
            "no-paper-order",
            "why-card-sealed",
          ],
        });
        await recordLesson({
          tenantId,
          ticker: assessment.ticker,
          action: "NO_TRADE",
          gate: "signal-rejected",
          movePct: parseMovePctNumber(assessment.movePct),
          score: assessment.score,
          outcome: "refused",
          summary: rationale,
          tags: ["signal"],
          source: "live",
          decisionId,
        });
        processed += 1;
        refused += 1;
        artifacts.push({
          eventId,
          signalId,
          decisionId,
          refused: true,
          gate: "signal",
          why: sealed,
        });
        continue;
      }

      const moveNum = parseMovePctNumber(assessment.movePct);
      const memory = await buildMemoryDigest({
        tenantId,
        ticker: assessment.ticker,
        movePct: moveNum,
      });

      // Deterministic lesson-guard before LLM (still seals a why-card)
      if (memory.guard.blockPaper) {
        const decisionId = newId("dec");
        const rationale = `${memory.guard.reason} · priors cited`;
        await db.insert(decisions).values({
          id: decisionId,
          tenantId,
          signalId,
          action: "WATCH",
          confidence: Math.min(settings.minConfidence - 1, 65),
          llmProvider: "memory-guard",
          llmModel: "deterministic",
          rationale,
          metricLabel: memory.metricLabel,
        });
        const sealed = await sealWhyCard(tenantId, decisionId, {
          eventId,
          signalId,
          decisionId,
          paperOrderId: null,
          headline: item.headline,
          ticker: assessment.ticker,
          action: "WATCH",
          confidence: Math.min(settings.minConfidence - 1, 65),
          windowState: window.state,
          llmProvider: "memory-guard",
          llmModel: "deterministic",
          rationale,
          memoryPriors: memory.blockLines,
          metricLabels: {
            event: item.metricLabel,
            signal: assessment.metricLabel,
            decision: memory.metricLabel,
            memory: memory.metricLabel,
          },
          gates: [
            "event-received",
            "closed-window-verified",
            "allowlist-pass",
            "signal-movement-checked",
            memory.guard.gate,
            "no-paper-order",
            "why-card-sealed",
          ],
        });
        await recordLesson({
          tenantId,
          ticker: assessment.ticker,
          action: "WATCH",
          gate: memory.guard.gate,
          movePct: moveNum,
          score: assessment.score,
          outcome: "watch",
          summary: rationale,
          tags: ["memory-guard"],
          source: "live",
          decisionId,
        });
        processed += 1;
        refused += 1;
        artifacts.push({
          eventId,
          signalId,
          decisionId,
          refused: true,
          gate: memory.guard.gate,
          why: sealed,
        });
        continue;
      }

      const llm = await scoreEventWithLlm({
        headline: item.headline,
        ticker: assessment.ticker,
        movePct: assessment.movePct,
        windowState: window.state,
        minConfidence: settings.minConfidence,
        allowlisted: true,
        memoryPriors: memory.blockLines,
      });

      let action = llm.decision.action;
      let rationale = llm.decision.rationale;
      const entryAnalysis = llm.decision.entryAnalysis ?? null;

      // Trader-discipline: PAPER_* requires complete bull/bear/invalidation/bias analysis
      if (
        (action === "PAPER_BUY" || action === "PAPER_SELL") &&
        !analysisCompleteForPaper(entryAnalysis)
      ) {
        action = "WATCH";
        rationale = `Incomplete entry rubric (need bull+≥2 bear+invalidation+biasChecks) · LLM had proposed ${llm.decision.action}`;
      }

      // One-side enforcement after LLM proposes a direction
      if (action === "PAPER_BUY" || action === "PAPER_SELL") {
        const side = action === "PAPER_BUY" ? "buy" : "sell";
        const sideGate = evaluateFennGates({
          fennMode,
          allowlist,
          ticker: assessment.ticker,
          paperedTickers,
          sidesByTicker,
          proposedSide: side,
        });
        if (!sideGate.allowPaper) {
          action = "NO_TRADE";
          rationale = `${sideGate.reason} · LLM had proposed ${llm.decision.action}`;
        }
      }

      const decisionId = newId("dec");
      await db.insert(decisions).values({
        id: decisionId,
        tenantId,
        signalId,
        action,
        confidence: llm.decision.confidence,
        llmProvider: llm.provider,
        llmModel: llm.model,
        rationale,
        metricLabel: llm.decision.metricLabel,
      });

      let paperOrderId: string | null = null;
      if (
        (action === "PAPER_BUY" || action === "PAPER_SELL") &&
        llm.decision.confidence >= settings.minConfidence
      ) {
        const side = action === "PAPER_BUY" ? "buy" : "sell";
        const symbol = `${assessment.ticker}USDT`;
        // Fixed small size — never "use the rest of the balance"
        const order = await placeBitgetPaperOrder({
          tenantId,
          symbol,
          side,
          size: fixedSize,
        });
        const mark = await fetchBitgetMarkQuote(symbol);
        const entryPx = mark ? mark.mark.toFixed(6) : null;
        paperOrderId = newId("ord");
        await db.insert(paperOrders).values({
          id: paperOrderId,
          tenantId,
          decisionId,
          symbol,
          side,
          quantity: fixedSize,
          price: entryPx,
          status: order.status,
          exchangeOrderId: order.exchangeOrderId,
          rawResponse: order.raw,
          metricLabel: order.metricLabel,
          lifecycle: "open",
          markPrice: entryPx,
          unrealizedPnl: "0",
          entryAnalysis: entryAnalysis ?? undefined,
        });
        papered += 1;
        paperedTickers.add(assessment.ticker.toUpperCase());
        sidesByTicker.set(assessment.ticker.toUpperCase(), side);
      } else {
        refused += 1;
      }

      const sealed = await sealWhyCard(tenantId, decisionId, {
        eventId,
        signalId,
        decisionId,
        paperOrderId,
        headline: item.headline,
        ticker: assessment.ticker,
        action,
        confidence: llm.decision.confidence,
        windowState: window.state,
        llmProvider: llm.provider,
        llmModel: llm.model,
        rationale,
        ...(entryAnalysis
          ? { entryAnalysis: entryAnalysis as unknown as Record<string, unknown> }
          : {}),
        memoryPriors: memory.blockLines,
        metricLabels: {
          event: item.metricLabel,
          signal: assessment.metricLabel,
          decision: llm.decision.metricLabel,
          memory: memory.metricLabel,
        },
        gates: [
          "event-received",
          "closed-window-verified",
          "allowlist-pass",
          "signal-movement-checked",
          "memory-retrieved",
          memory.guard.gate,
          "trader-rubric-scored",
          "policy-scored",
          paperOrderId ? "paper-order-accepted" : "no-paper-order",
          "why-card-sealed",
        ],
      });

      await recordLesson({
        tenantId,
        ticker: assessment.ticker,
        action,
        gate: paperOrderId ? "paper-open" : action === "WATCH" ? "watch" : "policy-refuse",
        movePct: moveNum,
        score: assessment.score,
        outcome: paperOrderId ? "watch" : action === "WATCH" ? "watch" : "refused",
        summary: rationale.slice(0, 400),
        tags: paperOrderId ? ["paper-open", "pending-exit"] : ["policy"],
        source: "live",
        decisionId,
        paperOrderId,
      });

      processed += 1;
      artifacts.push({
        eventId,
        signalId,
        decisionId,
        paperOrderId,
        llmPath: llm.path,
        why: sealed,
      });
    }

    const summary = {
      processed,
      papered,
      refused,
      newsCount: news.length,
      allowlist,
      fennMode,
      fixedPaperSize: fixedSize,
      window,
      artifacts,
      honesty: "paper-only · fenn refuse-by-default · metrics labeled · not financial advice",
      thesis: "Ten headlines, mostly NO cards, one named allowlisted paper when earned",
    };
    await finishRun(runId, "completed", summary);
    return { runId, status: "completed", windowState: window.state, summary };
  } catch (error) {
    const code = isVigilError(error) ? error.code : "INTERNAL";
    const message = error instanceof Error ? error.message : "Unknown pipeline error";
    await finishRun(runId, "failed", {}, code, message);
    return {
      runId,
      status: "failed",
      windowState: window.state,
      summary: {},
      errorCode: code,
      errorMessage: message,
    };
  }
}

async function finishRun(
  runId: string,
  status: "completed" | "skipped" | "failed",
  summary: Record<string, unknown>,
  errorCode?: string,
  errorMessage?: string,
) {
  const db = await getDb();
  await db
    .update(agentRuns)
    .set({
      status,
      finishedAt: new Date(),
      summary,
      errorCode,
      errorMessage,
    })
    .where(eq(agentRuns.id, runId));
}

export async function latestRun(tenantId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.tenantId, tenantId))
    .orderBy(desc(agentRuns.startedAt))
    .limit(1);
  return rows[0] ?? null;
}
