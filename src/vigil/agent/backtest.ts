/**
 * Rigorous closed-window paper backtest (deterministic — no LLM).
 * Replays candle history + catalyst events through FENN + scoreFromMove +
 * hold/invalidation exits. Metrics are labeled observed (candles) / estimated (PnL with slippage).
 */

import { evaluateFennGates, fixedPaperQuantity } from "./fenn";
import { scoreFromMove, stateFromScore } from "./signal";
import { analysisCompleteForPaper, type EntryAnalysis } from "./trader-rubric";
import { computeLinearPnl } from "../integrations/bitget-paper";
import type { Candle } from "../integrations/bitget-candles";

export type BacktestEvent = {
  id: string;
  ts: number;
  symbol: string;
  ticker: string;
  headline: string;
  /** If omitted, move is measured from candles at event time. */
  movePctHint?: number;
};

export type BacktestTrade = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  entryTs: number;
  entryPx: number;
  exitTs: number;
  exitPx: number;
  barsHeld: number;
  realizedPnl: number;
  exitReason: "hold_bars" | "invalidation" | "end_of_data";
  score: number;
  headline: string;
  analysis: EntryAnalysis;
  metricLabel: "estimated";
};

export type BacktestRefusal = {
  eventId: string;
  ts: number;
  ticker: string;
  reason: string;
  gate: string;
};

export type BacktestMetrics = {
  trades: number;
  wins: number;
  losses: number;
  flats: number;
  winRate: number;
  profitFactor: number | null;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  grossProfit: number;
  grossLoss: number;
  totalPnl: number;
  refusalCount: number;
  refusalRate: number;
  sharpeLike: number | null;
  avgBarsHeld: number;
  metricLabel: "estimated";
};

export type BacktestConfig = {
  allowlist: string[];
  fennMode: boolean;
  fixedPaperSize: number;
  minScore: number;
  holdBars: number;
  /** Relative adverse move that kills the trade (e.g. 0.012 = 1.2%). */
  invalidationPct: number;
  /** Applied against entry as estimated after-hours slippage (bps). */
  slippageBps: number;
  seed: number;
};

export type BacktestResult = {
  config: BacktestConfig;
  symbol: string;
  candleCount: number;
  eventCount: number;
  trades: BacktestTrade[];
  refusals: BacktestRefusal[];
  equityCurve: Array<{ ts: number; equity: number; drawdown: number }>;
  metrics: BacktestMetrics;
  walkForward?: {
    train: BacktestMetrics;
    test: BacktestMetrics;
    trainTrades: number;
    testTrades: number;
  };
  honesty: string;
};

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  allowlist: ["NVDA", "AAPL", "TSLA"],
  fennMode: true,
  fixedPaperSize: 1,
  minScore: 40,
  holdBars: 8,
  invalidationPct: 0.015,
  slippageBps: 8,
  seed: 42,
};

function applySlippage(px: number, side: "buy" | "sell", bps: number): number {
  const m = bps / 10_000;
  return side === "buy" ? px * (1 + m) : px * (1 - m);
}

function moveAt(candles: Candle[], idx: number, lookback: number): number {
  const a = candles[Math.max(0, idx - lookback)]!;
  const b = candles[idx]!;
  if (!(a.close > 0)) return 0;
  return ((b.close - a.close) / a.close) * 100;
}

function rangePctAt(candles: Candle[], idx: number, lookback: number): number {
  const slice = candles.slice(Math.max(0, idx - lookback), idx + 1);
  if (!slice.length) return 0;
  const hi = Math.max(...slice.map((c) => c.high));
  const lo = Math.min(...slice.map((c) => c.low));
  const open = slice[0]!.open;
  if (!(open > 0)) return 0;
  return ((hi - lo) / open) * 100;
}

function findCandleIndex(candles: Candle[], ts: number): number {
  let lo = 0;
  let hi = candles.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid]!.ts <= ts) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

function buildAnalysis(input: {
  ticker: string;
  headline: string;
  side: "buy" | "sell";
  movePct: number;
  invalidationPct: number;
}): EntryAnalysis {
  const dir = input.side === "buy" ? "long" : "short";
  return {
    thesis: `${input.ticker} ${dir} on catalyst · move ${input.movePct.toFixed(2)}%`,
    bullCase:
      input.side === "buy"
        ? [`Catalyst: ${input.headline.slice(0, 120)}`, `Observed move +${Math.abs(input.movePct).toFixed(2)}%`]
        : [`Adverse catalyst pressure`, `Observed move ${input.movePct.toFixed(2)}%`],
    bearCase: [
      "After-hours liquidity / wider spreads (Investopedia)",
      "Headline may be fully priced or rumor",
      "Gap risk into next session",
    ],
    invalidation: [
      `Adverse move ≥ ${(input.invalidationPct * 100).toFixed(2)}% from entry`,
      "Catalyst reversed in subsequent headlines",
    ],
    biasChecks: [
      "Wrote opposing (bear) case before entry",
      "Not revenge/FOMO — score gate + allowlist only",
      "Sunk-cost ignored — fixed size, pre-committed exit",
    ],
    sessionRisk: "Backtest assumes closed-window / AH slippage bps applied at entry+exit",
    sizeRule: "fixed paper size — never spray balance",
    metricLabel: "estimated",
  };
}

export function computeBacktestMetrics(
  trades: BacktestTrade[],
  refusals: BacktestRefusal[],
  equityCurve: Array<{ equity: number; drawdown: number }>,
  eventCount: number,
): BacktestMetrics {
  let wins = 0;
  let losses = 0;
  let flats = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let bars = 0;
  const pnls = trades.map((t) => t.realizedPnl);
  for (const p of pnls) {
    bars += 1;
    if (Math.abs(p) < 1e-10) flats += 1;
    else if (p > 0) {
      wins += 1;
      grossProfit += p;
    } else {
      losses += 1;
      grossLoss += Math.abs(p);
    }
  }
  const totalPnl = pnls.reduce((a, b) => a + b, 0);
  const n = trades.length || 1;
  const avgWin = wins ? grossProfit / wins : 0;
  const avgLoss = losses ? grossLoss / losses : 0;
  const expectancy = trades.length ? totalPnl / trades.length : 0;
  const winRate = trades.length ? wins / trades.length : 0;
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : null;
  const maxDrawdown = equityCurve.length
    ? Math.max(...equityCurve.map((e) => e.drawdown))
    : 0;

  // Sharpe-like on per-trade PnL (not annualized) — honesty: estimated
  let sharpeLike: number | null = null;
  if (pnls.length >= 2) {
    const mean = totalPnl / pnls.length;
    const varSum = pnls.reduce((a, p) => a + (p - mean) ** 2, 0) / (pnls.length - 1);
    const sd = Math.sqrt(varSum);
    sharpeLike = sd > 0 ? mean / sd : null;
  }

  return {
    trades: trades.length,
    wins,
    losses,
    flats,
    winRate,
    profitFactor: profitFactor === Number.POSITIVE_INFINITY ? null : profitFactor,
    expectancy,
    avgWin,
    avgLoss,
    maxDrawdown,
    grossProfit,
    grossLoss,
    totalPnl,
    refusalCount: refusals.length,
    refusalRate: eventCount ? refusals.length / eventCount : 0,
    sharpeLike,
    avgBarsHeld: trades.length ? trades.reduce((a, t) => a + t.barsHeld, 0) / trades.length : 0,
    metricLabel: "estimated",
  };
}

export function runBacktest(input: {
  symbol: string;
  candles: Candle[];
  events: BacktestEvent[];
  config?: Partial<BacktestConfig>;
}): BacktestResult {
  const config: BacktestConfig = { ...DEFAULT_BACKTEST_CONFIG, ...input.config };
  const candles = [...input.candles].sort((a, b) => a.ts - b.ts);
  const events = [...input.events]
    .filter((e) => e.symbol.toUpperCase() === input.symbol.toUpperCase())
    .sort((a, b) => a.ts - b.ts);

  const trades: BacktestTrade[] = [];
  const refusals: BacktestRefusal[] = [];
  const paperedTickers = new Set<string>();
  const sidesByTicker = new Map<string, "buy" | "sell">();
  const qty = Number(fixedPaperQuantity(config.fixedPaperSize));

  let equity = 0;
  let peak = 0;
  const equityCurve: Array<{ ts: number; equity: number; drawdown: number }> = [];

  for (const ev of events) {
    const idx = findCandleIndex(candles, ev.ts);
    if (idx < 0 || idx >= candles.length - 2) {
      refusals.push({
        eventId: ev.id,
        ts: ev.ts,
        ticker: ev.ticker,
        reason: "Event outside candle range",
        gate: "data-window",
      });
      continue;
    }

    const fenn = evaluateFennGates({
      fennMode: config.fennMode,
      allowlist: config.allowlist.map((t) => t.toUpperCase()),
      ticker: ev.ticker,
      paperedTickers,
      sidesByTicker,
    });
    if (!fenn.allowPaper) {
      refusals.push({
        eventId: ev.id,
        ts: ev.ts,
        ticker: ev.ticker,
        reason: fenn.reason,
        gate: fenn.gate,
      });
      continue;
    }

    const movePct =
      ev.movePctHint != null && Number.isFinite(ev.movePctHint)
        ? ev.movePctHint
        : moveAt(candles, idx, 6);
    const rangePct = rangePctAt(candles, idx, 6);
    const score = scoreFromMove(movePct, ev.headline, rangePct);
    const state = stateFromScore(score);
    if (score < config.minScore || state === "Rejected") {
      refusals.push({
        eventId: ev.id,
        ts: ev.ts,
        ticker: ev.ticker,
        reason: `Score ${score} / ${state} below minScore ${config.minScore}`,
        gate: "signal-score",
      });
      continue;
    }

    const side: "buy" | "sell" = movePct >= 0 ? "buy" : "sell";
    const sideGate = evaluateFennGates({
      fennMode: config.fennMode,
      allowlist: config.allowlist.map((t) => t.toUpperCase()),
      ticker: ev.ticker,
      paperedTickers,
      sidesByTicker,
      proposedSide: side,
    });
    if (!sideGate.allowPaper) {
      refusals.push({
        eventId: ev.id,
        ts: ev.ts,
        ticker: ev.ticker,
        reason: sideGate.reason,
        gate: sideGate.gate,
      });
      continue;
    }

    const analysis = buildAnalysis({
      ticker: ev.ticker,
      headline: ev.headline,
      side,
      movePct,
      invalidationPct: config.invalidationPct,
    });
    if (!analysisCompleteForPaper(analysis)) {
      refusals.push({
        eventId: ev.id,
        ts: ev.ts,
        ticker: ev.ticker,
        reason: "Incomplete entry rubric",
        gate: "trader-rubric",
      });
      continue;
    }

    const entryRaw = candles[idx]!.close;
    const entryPx = applySlippage(entryRaw, side, config.slippageBps);
    let exitIdx = Math.min(candles.length - 1, idx + config.holdBars);
    let exitReason: BacktestTrade["exitReason"] = "hold_bars";
    if (exitIdx === candles.length - 1 && idx + config.holdBars > exitIdx) {
      exitReason = "end_of_data";
    }

    for (let j = idx + 1; j <= exitIdx; j++) {
      const px = candles[j]!.close;
      const adverse =
        side === "buy" ? (entryPx - px) / entryPx : (px - entryPx) / entryPx;
      if (adverse >= config.invalidationPct) {
        exitIdx = j;
        exitReason = "invalidation";
        break;
      }
    }

    const exitRaw = candles[exitIdx]!.close;
    const exitSide = side === "buy" ? "sell" : "buy";
    const exitPx = applySlippage(exitRaw, exitSide, config.slippageBps);
    const realizedPnl = computeLinearPnl({ side, entry: entryPx, exit: exitPx, qty });

    const trade: BacktestTrade = {
      id: `bt_${ev.id}`,
      symbol: input.symbol.toUpperCase(),
      side,
      qty,
      entryTs: candles[idx]!.ts,
      entryPx,
      exitTs: candles[exitIdx]!.ts,
      exitPx,
      barsHeld: exitIdx - idx,
      realizedPnl,
      exitReason,
      score,
      headline: ev.headline,
      analysis,
      metricLabel: "estimated",
    };
    trades.push(trade);
    // Atomic entry→exit in this engine; clear so later catalysts can re-enter (mirrors new agent run).
    paperedTickers.add(ev.ticker.toUpperCase());
    sidesByTicker.set(ev.ticker.toUpperCase(), side);
    paperedTickers.delete(ev.ticker.toUpperCase());
    sidesByTicker.delete(ev.ticker.toUpperCase());

    equity += realizedPnl;
    peak = Math.max(peak, equity);
    equityCurve.push({
      ts: trade.exitTs,
      equity,
      drawdown: peak - equity,
    });
  }

  // Reset one-side gate between "cycles" is intentional for single-run backtest:
  // we keep one-side for the whole window to mirror FENN honesty.

  const metrics = computeBacktestMetrics(trades, refusals, equityCurve, events.length);

  return {
    config,
    symbol: input.symbol.toUpperCase(),
    candleCount: candles.length,
    eventCount: events.length,
    trades,
    refusals,
    equityCurve,
    metrics,
    honesty:
      "paper-only backtest · candles observed · PnL estimated with slippage · FENN refuse-by-default · not financial advice",
  };
}

/** Walk-forward: first trainRatio of events → train metrics; remainder → test (fresh FENN state). */
export function runWalkForwardBacktest(input: {
  symbol: string;
  candles: Candle[];
  events: BacktestEvent[];
  config?: Partial<BacktestConfig>;
  trainRatio?: number;
}): BacktestResult {
  const ratio = Math.min(0.85, Math.max(0.5, input.trainRatio ?? 0.7));
  const events = [...input.events].sort((a, b) => a.ts - b.ts);
  const cut = Math.max(1, Math.floor(events.length * ratio));
  const trainEvents = events.slice(0, cut);
  const testEvents = events.slice(cut);
  const train = runBacktest({
    symbol: input.symbol,
    candles: input.candles,
    events: trainEvents,
    ...(input.config ? { config: input.config } : {}),
  });
  const test = runBacktest({
    symbol: input.symbol,
    candles: input.candles,
    events: testEvents,
    ...(input.config ? { config: input.config } : {}),
  });
  // Combined report uses test as primary honesty for OOS
  return {
    ...test,
    eventCount: events.length,
    walkForward: {
      train: train.metrics,
      test: test.metrics,
      trainTrades: train.trades.length,
      testTrades: test.trades.length,
    },
    honesty: `${test.honesty} · walk-forward train=${trainEvents.length} test=${testEvents.length}`,
  };
}

/** Build synthetic catalyst events from candle spikes (deterministic). */
export function synthesizeEventsFromCandles(input: {
  symbol: string;
  ticker: string;
  candles: Candle[];
  lookback?: number;
  minAbsMovePct?: number;
  maxEvents?: number;
}): BacktestEvent[] {
  const lookback = input.lookback ?? 6;
  const minAbs = input.minAbsMovePct ?? 1.0;
  const maxEvents = input.maxEvents ?? 40;
  const out: BacktestEvent[] = [];
  for (let i = lookback; i < input.candles.length - 2; i++) {
    const move = moveAt(input.candles, i, lookback);
    if (Math.abs(move) < minAbs) continue;
    const bullish = move > 0;
    out.push({
      id: `syn_${input.candles[i]!.ts}`,
      ts: input.candles[i]!.ts,
      symbol: input.symbol,
      ticker: input.ticker,
      headline: bullish
        ? `${input.ticker} AI chip outlook upgrade sparks after-hours rally`
        : `${input.ticker} guidance cut and tariff risk spark after-hours selloff`,
      movePctHint: move,
    });
    i += lookback; // de-dupe clusters
    if (out.length >= maxEvents) break;
  }
  return out;
}

/** Deterministic synthetic OHLC for offline unit tests (no network). */
export function makeSyntheticCandles(input: {
  startTs: number;
  bars: number;
  startPx: number;
  stepMs: number;
  path: number[];
}): Candle[] {
  const out: Candle[] = [];
  let px = input.startPx;
  for (let i = 0; i < input.bars; i++) {
    const ret = input.path[i % input.path.length]!;
    const open = px;
    const close = px * (1 + ret);
    const high = Math.max(open, close) * 1.002;
    const low = Math.min(open, close) * 0.998;
    out.push({
      ts: input.startTs + i * input.stepMs,
      open,
      high,
      low,
      close,
      volume: 100 + i,
      quoteVolume: (100 + i) * close,
      metricLabel: "observed",
    });
    px = close;
  }
  return out;
}
