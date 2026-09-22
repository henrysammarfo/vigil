import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { agentRuns, decisions, events, paperOrders, signals, tenantSettings } from "../db/schema";
import { placeBitgetPaperOrder, assertPaperOnlySettings } from "../integrations/bitget-paper";
import { scoreEventWithLlm } from "../integrations/llm";
import { ingestClosedMarketNews } from "../integrations/news";
import { VigilError, isVigilError } from "../security/errors";
import { newId } from "../security/crypto";
import { evaluateClosedWindow } from "./closed-window";
import { sealWhyCard } from "./journal";
import { assessRtokenSignal } from "./signal";

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
  };

  assertPaperOnlySettings(settings.paperOnly !== false);

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
    const artifacts: unknown[] = [];

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

      if (assessment.state === "Rejected" || assessment.score < settings.minConfidence) {
        processed += 1;
        artifacts.push({ eventId, signalId, skipped: true, reason: assessment.state });
        continue;
      }

      const llm = await scoreEventWithLlm({
        headline: item.headline,
        ticker: assessment.ticker,
        movePct: assessment.movePct,
        windowState: window.state,
        minConfidence: settings.minConfidence,
      });

      const decisionId = newId("dec");
      await db.insert(decisions).values({
        id: decisionId,
        tenantId,
        signalId,
        action: llm.decision.action,
        confidence: llm.decision.confidence,
        llmProvider: llm.provider,
        llmModel: llm.model,
        rationale: llm.decision.rationale,
        metricLabel: llm.decision.metricLabel,
      });

      let paperOrderId: string | null = null;
      if (
        (llm.decision.action === "PAPER_BUY" || llm.decision.action === "PAPER_SELL") &&
        llm.decision.confidence >= settings.minConfidence
      ) {
        const side = llm.decision.action === "PAPER_BUY" ? "buy" : "sell";
        const size = String(Math.max(1, Math.floor(settings.maxPositionUsd / 1000)));
        const order = await placeBitgetPaperOrder({
          symbol: `${assessment.ticker}USDT`,
          side,
          size,
        });
        paperOrderId = newId("ord");
        await db.insert(paperOrders).values({
          id: paperOrderId,
          tenantId,
          decisionId,
          symbol: `${assessment.ticker}USDT`,
          side,
          quantity: size,
          status: order.status,
          exchangeOrderId: order.exchangeOrderId,
          rawResponse: order.raw,
          metricLabel: order.metricLabel,
        });
        papered += 1;
      }

      const sealed = await sealWhyCard(tenantId, decisionId, {
        eventId,
        signalId,
        decisionId,
        paperOrderId,
        headline: item.headline,
        ticker: assessment.ticker,
        action: llm.decision.action,
        confidence: llm.decision.confidence,
        windowState: window.state,
        llmProvider: llm.provider,
        llmModel: llm.model,
        rationale: llm.decision.rationale,
        metricLabels: {
          event: item.metricLabel,
          signal: assessment.metricLabel,
          decision: llm.decision.metricLabel,
        },
        gates: [
          "event-received",
          "closed-window-verified",
          "signal-movement-checked",
          "policy-scored",
          paperOrderId ? "paper-order-accepted" : "no-paper-order",
          "why-card-sealed",
        ],
      });

      processed += 1;
      artifacts.push({ eventId, signalId, decisionId, paperOrderId, why: sealed });
    }

    const summary = {
      processed,
      papered,
      newsCount: news.length,
      window,
      artifacts,
      honesty: "paper-only · metrics labeled · not financial advice",
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
