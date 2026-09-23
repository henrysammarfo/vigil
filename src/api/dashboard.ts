import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { runVigilPipeline } from "../vigil/agent/pipeline";
import { listWhyCards, getWhyCard } from "../vigil/agent/journal";
import { evaluateClosedWindow } from "../vigil/agent/closed-window";
import {
  closeOpenPaperOrder,
  enrichOrderRow,
  listEnrichedPaperOrders,
  paperScoreboard,
  refreshOpenPaperMarks,
} from "../vigil/agent/paper-ledger";
import {
  credentialsSchema,
  loginUser,
  logoutSession,
  registerUser,
  requireSession,
} from "../vigil/auth/session";
import { getDb } from "../vigil/db/client";
import {
  contactMessages,
  decisions,
  signals,
  tenantSettings,
  tenants,
  whyCards,
} from "../vigil/db/schema";
import { isVigilError } from "../vigil/security/errors";
import { newId, rateLimit } from "../vigil/security/crypto";

function cookieHeader(): string | null {
  return getRequest().headers.get("cookie");
}

function toErrorPayload(error: unknown) {
  if (isVigilError(error)) {
    return { ok: false as const, code: error.code, message: error.message, status: error.status };
  }
  const message = error instanceof Error ? error.message : "Internal error";
  return { ok: false as const, code: "INTERNAL" as const, message, status: 500 };
}

export const registerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => credentialsSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const result = await registerUser(data);
      setResponseHeader("Set-Cookie", result.setCookie);
      return { ok: true as const, user: result.ctx };
    } catch (error) {
      return toErrorPayload(error);
    }
  });

export const loginFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ email: z.string().email(), password: z.string().min(10) }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const result = await loginUser(data);
      setResponseHeader("Set-Cookie", result.setCookie);
      return { ok: true as const, user: result.ctx };
    } catch (error) {
      return toErrorPayload(error);
    }
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const setCookie = await logoutSession(cookieHeader());
  setResponseHeader("Set-Cookie", setCookie);
  return { ok: true as const };
});

export const meFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const ctx = await requireSession(cookieHeader());
    return { ok: true as const, user: ctx };
  } catch (error) {
    return toErrorPayload(error);
  }
});

export const dashboardOverviewFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const ctx = await requireSession(cookieHeader());
    const db = await getDb();
    const signalRows = await db
      .select()
      .from(signals)
      .where(eq(signals.tenantId, ctx.tenantId))
      .orderBy(desc(signals.createdAt))
      .limit(20);
    const orderRows = await listEnrichedPaperOrders(ctx.tenantId, 40);
    // Best-effort mark refresh for open Demo positions (non-blocking if quotes fail)
    try {
      await refreshOpenPaperMarks(ctx.tenantId);
    } catch {
      // keep prior rows
    }
    const ordersFresh = await listEnrichedPaperOrders(ctx.tenantId, 40);
    const decisionRows = await db
      .select()
      .from(decisions)
      .where(eq(decisions.tenantId, ctx.tenantId))
      .orderBy(desc(decisions.createdAt))
      .limit(20);
    const why = await listWhyCards(ctx.tenantId, 20);
    const settings = await db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, ctx.tenantId))
      .limit(1);
    const window = evaluateClosedWindow(new Date(), {
      weekendWatch: settings[0]?.weekendWatch ?? true,
      afterHoursWatch: settings[0]?.afterHoursWatch ?? true,
    });
    const scoreboard = paperScoreboard(ordersFresh.length ? ordersFresh : orderRows);
    return {
      ok: true as const,
      window,
      signals: signalRows,
      orders: ordersFresh.length ? ordersFresh : orderRows,
      decisions: decisionRows,
      whyCards: why,
      settings: settings[0] ?? null,
      scoreboard,
    };
  } catch (error) {
    return toErrorPayload(error);
  }
});

export const runAgentFn = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const ctx = await requireSession(cookieHeader());
    if (!rateLimit(`agent:${ctx.tenantId}`, 6, 60_000)) {
      return {
        ok: false as const,
        code: "RATE_LIMITED",
        message: "Agent run rate limited",
        status: 429,
      };
    }
    const result = await runVigilPipeline(ctx.tenantId);
    return { ok: true as const, result };
  } catch (error) {
    return toErrorPayload(error);
  }
});

export const updateSettingsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        weekendWatch: z.boolean(),
        afterHoursWatch: z.boolean(),
        maxPositionUsd: z.number().int().min(100).max(1_000_000),
        minConfidence: z.number().int().min(0).max(100),
        llmDeclared: z.string().min(1).max(200),
        fennMode: z.boolean(),
        allowlist: z.array(z.string().min(1).max(16)).max(50),
        fixedPaperSize: z.number().int().min(1).max(10),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const ctx = await requireSession(cookieHeader());
      const db = await getDb();
      const allowlist = [
        ...new Set(data.allowlist.map((t) => t.trim().toUpperCase()).filter(Boolean)),
      ];
      await db
        .insert(tenantSettings)
        .values({
          tenantId: ctx.tenantId,
          weekendWatch: data.weekendWatch,
          afterHoursWatch: data.afterHoursWatch,
          paperOnly: true,
          maxPositionUsd: data.maxPositionUsd,
          minConfidence: data.minConfidence,
          llmDeclared: data.llmDeclared,
          fennMode: data.fennMode,
          allowlist,
          fixedPaperSize: data.fixedPaperSize,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: tenantSettings.tenantId,
          set: {
            weekendWatch: data.weekendWatch,
            afterHoursWatch: data.afterHoursWatch,
            paperOnly: true,
            maxPositionUsd: data.maxPositionUsd,
            minConfidence: data.minConfidence,
            llmDeclared: data.llmDeclared,
            fennMode: data.fennMode,
            allowlist,
            fixedPaperSize: data.fixedPaperSize,
            updatedAt: new Date(),
          },
        });
      return { ok: true as const };
    } catch (error) {
      return toErrorPayload(error);
    }
  });

export const whyCardFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    try {
      const ctx = await requireSession(cookieHeader());
      const card = await getWhyCard(ctx.tenantId, data.id);
      if (!card) {
        return {
          ok: false as const,
          code: "NOT_FOUND",
          message: "Why-card not found",
          status: 404,
        };
      }
      return { ok: true as const, card };
    } catch (error) {
      return toErrorPayload(error);
    }
  });

export const exportPaperLogFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const ctx = await requireSession(cookieHeader());
    try {
      await refreshOpenPaperMarks(ctx.tenantId);
    } catch {
      // export still useful without marks
    }
    const orders = await listEnrichedPaperOrders(ctx.tenantId, 500);
    const why = await listWhyCards(ctx.tenantId, 500);
    return {
      ok: true as const,
      exportedAt: new Date().toISOString(),
      tenantId: ctx.tenantId,
      paperOnly: true,
      scoreboard: paperScoreboard(orders),
      orders,
      whyCards: why,
    };
  } catch (error) {
    return toErrorPayload(error);
  }
});

export const markPaperOrdersFn = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const ctx = await requireSession(cookieHeader());
    if (!rateLimit(`mark:${ctx.tenantId}`, 20, 60_000)) {
      return {
        ok: false as const,
        code: "RATE_LIMITED",
        message: "Mark refresh rate limited",
        status: 429,
      };
    }
    const marked = await refreshOpenPaperMarks(ctx.tenantId);
    const all = await listEnrichedPaperOrders(ctx.tenantId, 100);
    return {
      ok: true as const,
      marked: marked.length,
      scoreboard: paperScoreboard(all),
      orders: all,
    };
  } catch (error) {
    return toErrorPayload(error);
  }
});

export const closePaperOrderFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ orderId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    try {
      const ctx = await requireSession(cookieHeader());
      if (!rateLimit(`close:${ctx.tenantId}`, 12, 60_000)) {
        return {
          ok: false as const,
          code: "RATE_LIMITED",
          message: "Close rate limited",
          status: 429,
        };
      }
      const closed = await closeOpenPaperOrder(ctx.tenantId, data.orderId);
      const all = await listEnrichedPaperOrders(ctx.tenantId, 100);
      return {
        ok: true as const,
        order: enrichOrderRow(closed),
        scoreboard: paperScoreboard(all),
      };
    } catch (error) {
      return toErrorPayload(error);
    }
  });

export const publicJournalFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = await getDb();
    const slug = process.env["VIGIL_DEFAULT_TENANT_SLUG"]?.trim();
    let publicTenantId: string | null = null;
    if (slug) {
      const tenantRows = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
      publicTenantId = tenantRows[0]?.id ?? null;
    }
    if (!publicTenantId) {
      // Demo-friendly fallback: newest sealed why-card's tenant (no env required).
      const latest = await db
        .select({ tenantId: whyCards.tenantId })
        .from(whyCards)
        .orderBy(desc(whyCards.sealedAt))
        .limit(1);
      publicTenantId = latest[0]?.tenantId ?? null;
    }
    if (!publicTenantId) {
      return { ok: true as const, rows: [] as Array<Record<string, unknown>> };
    }
    const cards = await listWhyCards(publicTenantId, 30);
    return {
      ok: true as const,
      rows: cards.map((c) => {
        const body = c.body as Record<string, unknown>;
        return {
          ticker: body.ticker,
          headline: body.headline,
          action: body.action,
          metricLabel:
            (body.metricLabels as Record<string, string> | undefined)?.decision ?? "estimated",
          sealedAt: c.sealedAt,
          contentHash: c.contentHash,
        };
      }),
    };
  } catch (error) {
    return toErrorPayload(error);
  }
});

export const contactFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        email: z.string().email().max(320),
        message: z.string().min(1).max(5000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      if (!rateLimit(`contact:${data.email.toLowerCase()}`, 5, 60_000)) {
        return {
          ok: false as const,
          code: "RATE_LIMITED",
          message: "Too many contact attempts",
          status: 429,
        };
      }
      const db = await getDb();
      await db.insert(contactMessages).values({
        id: newId("msg"),
        name: data.name,
        email: data.email.toLowerCase(),
        message: data.message,
      });
      return { ok: true as const };
    } catch (error) {
      return toErrorPayload(error);
    }
  });

export const windowStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  return { ok: true as const, window: evaluateClosedWindow() };
});

export const memoryDigestFn = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z
      .object({
        ticker: z.string().min(1).max(16).default("NVDA"),
        movePct: z.number().default(1.5),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    try {
      const ctx = await requireSession(cookieHeader());
      const {
        buildMemoryDigest,
        listRecentLessons,
        memoryStats,
      } = await import("../vigil/agent/memory");
      const digest = await buildMemoryDigest({
        tenantId: ctx.tenantId,
        ticker: data.ticker,
        movePct: data.movePct,
      });
      const [lessons, stats] = await Promise.all([
        listRecentLessons(ctx.tenantId, 30),
        memoryStats(ctx.tenantId),
      ]);
      return { ok: true as const, digest, lessons, stats };
    } catch (error) {
      return toErrorPayload(error);
    }
  });

export const terminalSnapshotFn = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z
      .object({
        symbol: z.string().min(3).max(24).default("NVDAUSDT"),
        granularity: z.enum(["1m", "5m", "15m", "30m", "1H", "4H", "1D"]).default("15m"),
        limit: z.number().int().min(20).max(200).default(96),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    try {
      const ctx = await requireSession(cookieHeader());
      const { fetchBitgetCandles } = await import("../vigil/integrations/bitget-candles");
      const { fetchBitgetMarkQuote } = await import("../vigil/integrations/bitget-paper");
      try {
        await refreshOpenPaperMarks(ctx.tenantId);
      } catch {
        // quotes optional
      }
      const symbol = data.symbol.toUpperCase();
      const [candles, quote, orders] = await Promise.all([
        fetchBitgetCandles({
          symbol,
          granularity: data.granularity,
          limit: data.limit,
        }),
        fetchBitgetMarkQuote(symbol),
        listEnrichedPaperOrders(ctx.tenantId, 80),
      ]);
      const symbolOrders = orders.filter((o) => o.symbol.toUpperCase() === symbol);
      const scoreboard = paperScoreboard(orders);
      return {
        ok: true as const,
        symbol,
        granularity: data.granularity,
        candles,
        quote,
        orders: symbolOrders,
        allOrders: orders,
        scoreboard,
        fetchedAt: new Date().toISOString(),
        metricLabel: "observed" as const,
      };
    } catch (error) {
      return toErrorPayload(error);
    }
  });

export const runBacktestFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        symbol: z.string().min(3).max(24).default("NVDAUSDT"),
        granularity: z.enum(["15m", "1H", "4H"]).default("1H"),
        lookbackBars: z.number().int().min(80).max(800).default(360),
        minAbsMovePct: z.number().min(0.3).max(8).default(1.0),
        minScore: z.number().int().min(0).max(100).default(40),
        holdBars: z.number().int().min(1).max(48).default(12),
        stopLossPct: z.number().min(0.005).max(0.1).default(0.012),
        riskReward: z.number().min(0.5).max(5).default(2),
        invalidationPct: z.number().min(0.005).max(0.1).default(0.012),
        entryType: z.enum(["market", "limit"]).default("market"),
        limitOffsetBps: z.number().int().min(0).max(100).default(12),
        limitTimeoutBars: z.number().int().min(1).max(12).default(3),
        slippageBps: z.number().int().min(0).max(50).default(8),
        allowlist: z.array(z.string().min(1).max(16)).max(20).optional(),
        walkForward: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const ctx = await requireSession(cookieHeader());
      if (!rateLimit(`backtest:${ctx.tenantId}`, 6, 60_000)) {
        return {
          ok: false as const,
          code: "RATE_LIMITED",
          message: "Backtest rate limited",
          status: 429,
        };
      }
      const { fetchBitgetHistoryCandles } = await import("../vigil/integrations/bitget-candles");
      const {
        runBacktest,
        runWalkForwardBacktest,
        synthesizeEventsFromCandles,
      } = await import("../vigil/agent/backtest");

      const symbol = data.symbol.toUpperCase();
      const ticker = symbol.replace(/USDT$/, "");
      const candles = await fetchBitgetHistoryCandles({
        symbol,
        granularity: data.granularity,
        lookbackBars: data.lookbackBars,
      });
      if (candles.length < 40) {
        return {
          ok: false as const,
          code: "VALIDATION_ERROR",
          message: `Not enough candles (${candles.length})`,
          status: 400,
        };
      }
      const events = synthesizeEventsFromCandles({
        symbol,
        ticker,
        candles,
        minAbsMovePct: data.minAbsMovePct,
        maxEvents: 48,
      });
      const allowlist = (data.allowlist?.length ? data.allowlist : [ticker]).map((t) =>
        t.toUpperCase(),
      );
      const config = {
        allowlist,
        fennMode: true,
        minScore: data.minScore,
        holdBars: data.holdBars,
        stopLossPct: data.stopLossPct,
        riskReward: data.riskReward,
        invalidationPct: data.invalidationPct,
        entryType: data.entryType,
        limitOffsetBps: data.limitOffsetBps,
        limitTimeoutBars: data.limitTimeoutBars,
        slippageBps: data.slippageBps,
      };
      const result = data.walkForward
        ? runWalkForwardBacktest({ symbol, candles, events, config, trainRatio: 0.7 })
        : runBacktest({ symbol, candles, events, config });

      const { ingestBacktestLessons } = await import("../vigil/agent/memory");
      const learned = await ingestBacktestLessons({
        tenantId: ctx.tenantId,
        symbol,
        trades: result.trades.map((t) => ({
          side: t.side,
          realizedPnl: t.realizedPnl,
          score: t.score,
          headline: t.headline,
          entryPx: t.entryPx,
          exitReason: t.exitReason,
        })),
        refusals: result.refusals.map((r) => ({
          ticker: r.ticker,
          reason: r.reason,
          gate: r.gate,
        })),
      });

      return {
        ok: true as const,
        result: {
          symbol: result.symbol,
          candleCount: result.candleCount,
          eventCount: result.eventCount,
          metrics: result.metrics,
          walkForward: result.walkForward ?? null,
          equityCurve: result.equityCurve,
          trades: result.trades.slice(0, 60),
          refusals: result.refusals.slice(0, 40),
          honesty: result.honesty,
          config: result.config,
          lessonsWritten: learned.written,
        },
      };
    } catch (error) {
      return toErrorPayload(error);
    }
  });
