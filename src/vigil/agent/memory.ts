/**
 * Fast smart agent memory — structured lessons, not embeddings.
 * Retrieve by ticker + move band + outcome. Cite priors in LLM + why-cards.
 * Learn from live paper closes, refusals, and backtest batches.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { agentLessons } from "../db/schema";
import { newId } from "../security/crypto";

export type LessonOutcome =
  | "refused"
  | "watch"
  | "win"
  | "loss"
  | "flat"
  | "backtest_win"
  | "backtest_loss"
  | "backtest_flat"
  | "backtest_refuse";

export type LessonSource = "live" | "backtest" | "seed";

export type AgentLesson = {
  id: string;
  tenantId: string;
  ticker: string;
  symbol: string;
  action: string;
  gate: string;
  movePct: number;
  score: number;
  outcome: LessonOutcome;
  realizedPnl: number | null;
  summary: string;
  tags: string[];
  source: LessonSource;
  decisionId: string | null;
  paperOrderId: string | null;
  createdAt: Date;
};

export type MemoryPrior = {
  id: string;
  ticker: string;
  outcome: LessonOutcome;
  movePct: number;
  realizedPnl: number | null;
  summary: string;
  gate: string;
  source: LessonSource;
  createdAt: Date;
};

export type MemoryDigest = {
  ticker: string;
  priors: MemoryPrior[];
  closedSample: number;
  expectancy: number | null;
  winRate: number | null;
  recentLossStreak: number;
  guard: {
    blockPaper: boolean;
    reason: string;
    gate: string;
  };
  blockLines: string[];
  metricLabel: "observed" | "estimated";
};

/** Process-local hot cache (fast path). Keyed tenant|ticker|bucket */
const hotCache = new Map<string, { at: number; rows: MemoryPrior[] }>();
const HOT_TTL_MS = 15_000;
const HOT_MAX = 256;

function cacheKey(tenantId: string, ticker: string, bucket: number): string {
  return `${tenantId}|${ticker}|${bucket}`;
}

function touchCache(key: string, rows: MemoryPrior[]): void {
  if (hotCache.size >= HOT_MAX) {
    const first = hotCache.keys().next().value;
    if (first) hotCache.delete(first);
  }
  hotCache.set(key, { at: Date.now(), rows });
}

export function clearMemoryHotCache(): void {
  hotCache.clear();
}

export function parseMovePctNumber(movePct: string | number): number {
  if (typeof movePct === "number") return Number.isFinite(movePct) ? movePct : 0;
  const n = Number(String(movePct).replace(/%/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** Coarse band for similarity: 0, 1, 2, 3… = floor(|move|) */
export function moveBucket(movePct: number): number {
  return Math.min(20, Math.floor(Math.abs(movePct)));
}

export function outcomeFromPnl(
  pnl: number,
  source: "live" | "backtest" = "live",
): LessonOutcome {
  if (Math.abs(pnl) < 1e-10) return source === "backtest" ? "backtest_flat" : "flat";
  if (pnl > 0) return source === "backtest" ? "backtest_win" : "win";
  return source === "backtest" ? "backtest_loss" : "loss";
}

export async function recordLesson(input: {
  tenantId: string;
  ticker: string;
  symbol?: string;
  action: string;
  gate: string;
  movePct: number;
  score?: number;
  outcome: LessonOutcome;
  realizedPnl?: number | null;
  summary: string;
  tags?: string[];
  source: LessonSource;
  decisionId?: string | null;
  paperOrderId?: string | null;
}): Promise<AgentLesson> {
  const db = await getDb();
  const ticker = input.ticker.trim().toUpperCase();
  const id = newId("les");
  const row = {
    id,
    tenantId: input.tenantId,
    ticker,
    symbol: (input.symbol ?? `${ticker}USDT`).toUpperCase(),
    action: input.action,
    gate: input.gate,
    movePct: String(input.movePct),
    score: input.score ?? 0,
    outcome: input.outcome,
    realizedPnl:
      input.realizedPnl == null || !Number.isFinite(input.realizedPnl)
        ? null
        : String(input.realizedPnl),
    summary: input.summary.slice(0, 480),
    tags: input.tags ?? [],
    source: input.source,
    decisionId: input.decisionId ?? null,
    paperOrderId: input.paperOrderId ?? null,
    createdAt: new Date(),
  };
  await db.insert(agentLessons).values(row);
  // Invalidate hot cache for this ticker
  for (const k of [...hotCache.keys()]) {
    if (k.startsWith(`${input.tenantId}|${ticker}|`)) hotCache.delete(k);
  }
  return {
    ...row,
    movePct: input.movePct,
    realizedPnl: input.realizedPnl ?? null,
    tags: row.tags,
  };
}

export async function retrievePriors(input: {
  tenantId: string;
  ticker: string;
  movePct: number;
  limit?: number;
}): Promise<MemoryPrior[]> {
  const ticker = input.ticker.trim().toUpperCase();
  const bucket = moveBucket(input.movePct);
  const key = cacheKey(input.tenantId, ticker, bucket);
  const hit = hotCache.get(key);
  if (hit && Date.now() - hit.at < HOT_TTL_MS) return hit.rows.slice(0, input.limit ?? 8);

  const db = await getDb();
  const limit = Math.min(24, Math.max(3, input.limit ?? 8));
  // Prefer same ticker; soft-prefer nearby move magnitude via abs(move) proximity in JS
  const rows = await db
    .select()
    .from(agentLessons)
    .where(and(eq(agentLessons.tenantId, input.tenantId), eq(agentLessons.ticker, ticker)))
    .orderBy(desc(agentLessons.createdAt))
    .limit(48);

  const scored = rows
    .map((r) => {
      const mv = parseMovePctNumber(r.movePct);
      const dist = Math.abs(Math.abs(mv) - Math.abs(input.movePct));
      const outcomeBoost =
        r.outcome.includes("loss") || r.outcome === "refused" ? 0.15 : r.outcome.includes("win") ? 0.1 : 0;
      return {
        prior: {
          id: r.id,
          ticker: r.ticker,
          outcome: r.outcome as LessonOutcome,
          movePct: mv,
          realizedPnl: r.realizedPnl != null ? Number(r.realizedPnl) : null,
          summary: r.summary,
          gate: r.gate,
          source: r.source as LessonSource,
          createdAt: r.createdAt,
        } satisfies MemoryPrior,
        rank: dist - outcomeBoost,
      };
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((x) => x.prior);

  touchCache(key, scored);
  return scored;
}

function closedOutcomes(priors: MemoryPrior[]): MemoryPrior[] {
  return priors.filter((p) =>
    ["win", "loss", "flat", "backtest_win", "backtest_loss", "backtest_flat"].includes(p.outcome),
  );
}

export function evaluateLessonGuard(priors: MemoryPrior[]): MemoryDigest["guard"] {
  const closed = closedOutcomes(priors);
  if (closed.length < 3) {
    return { blockPaper: false, reason: "Insufficient closed-sample memory", gate: "memory-warm" };
  }
  const pnls = closed.map((p) => p.realizedPnl ?? 0);
  const expectancy = pnls.reduce((a, b) => a + b, 0) / pnls.length;
  const losses = closed.filter((p) => p.outcome.includes("loss")).length;
  const winRate = (closed.length - losses) / closed.length;
  const byTime = [...closed].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  let streak = 0;
  for (const p of byTime) {
    if (p.outcome.includes("loss")) streak += 1;
    else break;
  }

  if (expectancy < -0.5 && closed.length >= 3) {
    return {
      blockPaper: true,
      reason: `Memory guard: ${closed.length}-trade expectancy ${expectancy.toFixed(3)} < -0.5`,
      gate: "lesson-guard",
    };
  }
  if (streak >= 3) {
    return {
      blockPaper: true,
      reason: `Memory guard: ${streak} consecutive losses on this name`,
      gate: "lesson-guard-streak",
    };
  }
  if (winRate <= 0.2 && closed.length >= 5) {
    return {
      blockPaper: true,
      reason: `Memory guard: win rate ${(winRate * 100).toFixed(0)}% over ${closed.length} closes`,
      gate: "lesson-guard-wr",
    };
  }
  return {
    blockPaper: false,
    reason: `Memory clear: n=${closed.length} E=${expectancy.toFixed(3)} WR=${(winRate * 100).toFixed(0)}%`,
    gate: "memory-pass",
  };
}

export function formatMemoryBlock(digest: MemoryDigest): string[] {
  const lines: string[] = [];
  lines.push(
    `memory[${digest.ticker}]: sample=${digest.closedSample} E=${digest.expectancy?.toFixed(3) ?? "n/a"} WR=${
      digest.winRate != null ? `${(digest.winRate * 100).toFixed(0)}%` : "n/a"
    } streakLoss=${digest.recentLossStreak} · ${digest.guard.gate}`,
  );
  for (const p of digest.priors.slice(0, 5)) {
    const pnl =
      p.realizedPnl == null ? "" : ` pnl=${p.realizedPnl > 0 ? "+" : ""}${p.realizedPnl.toFixed(3)}`;
    lines.push(
      `prior: ${p.outcome} move=${p.movePct.toFixed(2)}%${pnl} · ${p.summary.slice(0, 120)} [${p.source}]`,
    );
  }
  return lines;
}

export async function buildMemoryDigest(input: {
  tenantId: string;
  ticker: string;
  movePct: number;
}): Promise<MemoryDigest> {
  const priors = await retrievePriors(input);
  const closed = closedOutcomes(priors);
  const pnls = closed.map((p) => p.realizedPnl ?? 0);
  const expectancy = closed.length ? pnls.reduce((a, b) => a + b, 0) / closed.length : null;
  const wins = closed.filter((p) => p.outcome.includes("win")).length;
  const winRate = closed.length ? wins / closed.length : null;
  const byTime = [...closed].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  let recentLossStreak = 0;
  for (const p of byTime) {
    if (p.outcome.includes("loss")) recentLossStreak += 1;
    else break;
  }
  const guard = evaluateLessonGuard(priors);
  const digest: MemoryDigest = {
    ticker: input.ticker.toUpperCase(),
    priors,
    closedSample: closed.length,
    expectancy,
    winRate,
    recentLossStreak,
    guard,
    blockLines: [],
    metricLabel: closed.some((p) => p.source === "live") ? "observed" : "estimated",
  };
  digest.blockLines = formatMemoryBlock(digest);
  return digest;
}

export async function listRecentLessons(
  tenantId: string,
  limit = 40,
): Promise<AgentLesson[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(agentLessons)
    .where(eq(agentLessons.tenantId, tenantId))
    .orderBy(desc(agentLessons.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    ticker: r.ticker,
    symbol: r.symbol,
    action: r.action,
    gate: r.gate,
    movePct: parseMovePctNumber(r.movePct),
    score: r.score,
    outcome: r.outcome as LessonOutcome,
    realizedPnl: r.realizedPnl != null ? Number(r.realizedPnl) : null,
    summary: r.summary,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    source: r.source as LessonSource,
    decisionId: r.decisionId,
    paperOrderId: r.paperOrderId,
    createdAt: r.createdAt,
  }));
}

export async function memoryStats(tenantId: string): Promise<{
  total: number;
  byOutcome: Record<string, number>;
  tickers: number;
}> {
  const db = await getDb();
  const rows = await db
    .select({
      outcome: agentLessons.outcome,
      n: sql<number>`count(*)::int`,
    })
    .from(agentLessons)
    .where(eq(agentLessons.tenantId, tenantId))
    .groupBy(agentLessons.outcome);
  const byOutcome: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byOutcome[r.outcome] = Number(r.n);
    total += Number(r.n);
  }
  const tickers = await db
    .select({ ticker: agentLessons.ticker })
    .from(agentLessons)
    .where(eq(agentLessons.tenantId, tenantId))
    .groupBy(agentLessons.ticker);
  return { total, byOutcome, tickers: tickers.length };
}

/** Persist backtest trades/refusals as lessons (batch). */
export async function ingestBacktestLessons(input: {
  tenantId: string;
  symbol: string;
  trades: Array<{
    side: string;
    realizedPnl: number;
    score: number;
    headline: string;
    entryPx: number;
    exitReason: string;
  }>;
  refusals: Array<{ ticker: string; reason: string; gate: string }>;
  movePctDefault?: number;
}): Promise<{ written: number }> {
  const ticker = input.symbol.replace(/USDT$/i, "").toUpperCase();
  let written = 0;
  for (const t of input.trades.slice(0, 40)) {
    await recordLesson({
      tenantId: input.tenantId,
      ticker,
      symbol: input.symbol,
      action: t.side === "sell" ? "PAPER_SELL" : "PAPER_BUY",
      gate: `backtest-${t.exitReason}`,
      movePct: input.movePctDefault ?? 1.5,
      score: t.score,
      outcome: outcomeFromPnl(t.realizedPnl, "backtest"),
      realizedPnl: t.realizedPnl,
      summary: `${t.headline.slice(0, 160)} · exit ${t.exitReason} @~${t.entryPx.toFixed(2)}`,
      tags: ["backtest", t.exitReason],
      source: "backtest",
    });
    written += 1;
  }
  for (const r of input.refusals.slice(0, 20)) {
    await recordLesson({
      tenantId: input.tenantId,
      ticker: r.ticker.toUpperCase(),
      symbol: `${r.ticker.toUpperCase()}USDT`,
      action: "NO_TRADE",
      gate: r.gate,
      movePct: 0,
      outcome: "backtest_refuse",
      summary: r.reason.slice(0, 240),
      tags: ["backtest", "refuse"],
      source: "backtest",
    });
    written += 1;
  }
  return { written };
}
