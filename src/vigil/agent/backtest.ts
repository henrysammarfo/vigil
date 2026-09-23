/**
 * Rigorous closed-window paper backtest (deterministic — no LLM).
 * Replays candle history + catalyst events through FENN + scoreFromMove +
 * hold/invalidation exits. Metrics are labeled observed (candles) / estimated (PnL with slippage).
 */

import { evaluateFennGates, fixedPaperQuantity } from "./fenn";
import { scoreFromMove, stateFromScore } from "./signal";
import { analysisCompleteForPaper, type EntryAnalysis } from "./trader-rubric";
import {
  BITGET_VIP0_FUTURES_COSTS,
  computeRoundTripCosts,
  effectiveHalfSpreadBps,
  type TradingCostConfig,
} from "./trading-costs";
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
  entryType: "market" | "limit";
  entryTs: number;
  entryPx: number;
  stopPx: number;
  takeProfitPx: number;
  riskPx: number;
  rewardPx: number;
  riskReward: number;
  exitTs: number;
  exitPx: number;
  barsHeld: number;
  /** Gross price PnL before fees/spread/rebates. */
  grossPnl: number;
  feesPaid: number;
  rebatesEarned: number;
  spreadCost: number;
  /** Net realized after fees − rebates + spread. */
  realizedPnl: number;
  /** PnL in units of initial risk (R-multiples) using net PnL. */
  rMultiple: number;
  exitReason: "stop_loss" | "take_profit" | "hold_bars" | "invalidation" | "end_of_data";
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
  /** Expectancy in R-multiples (risk units). */
  expectancyR: number;
  avgWin: number;
  avgLoss: number;
  avgR: number;
  maxDrawdown: number;
  grossProfit: number;
  grossLoss: number;
  totalPnl: number;
  /** Sum of gross price PnL (pre-cost). */
  grossPnlSum: number;
  totalFees: number;
  totalRebates: number;
  totalSpreadCost: number;
  stopExits: number;
  tpExits: number;
  refusalCount: number;
  refusalRate: number;
  unfilledLimits: number;
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
  /** Stop-loss distance from entry (e.g. 0.012 = 1.2%). Also used as 1R. */
  stopLossPct: number;
  /** Take-profit as multiple of risk (R:R). 2 = risk 1 to make 2. */
  riskReward: number;
  /** @deprecated alias — maps to stopLossPct when stopLossPct unset in partial merges */
  invalidationPct: number;
  /** market = fill at signal close + slippage; limit = wait for pullback fill */
  entryType: "market" | "limit";
  /** Limit offset from signal close toward better price (bps). */
  limitOffsetBps: number;
  /** Bars to wait for limit fill before cancelling. */
  limitTimeoutBars: number;
  /** Applied on market fills and on stop/TP slippage (estimated). */
  slippageBps: number;
  /** with_move = chase catalyst; fade_move = mean-revert the spike */
  directionMode: "with_move" | "fade_move";
  /** Bitget fee/spread/rebate model (VIP0 defaults). */
  costs: TradingCostConfig;
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
  allowlist: ["NVDA", "AAPL", "TSLA", "AMD"],
  fennMode: true,
  fixedPaperSize: 1,
  minScore: 40,
  holdBars: 12,
  stopLossPct: 0.012,
  riskReward: 2,
  invalidationPct: 0.012,
  entryType: "market",
  limitOffsetBps: 12,
  limitTimeoutBars: 3,
  slippageBps: 8,
  directionMode: "with_move",
  costs: { ...BITGET_VIP0_FUTURES_COSTS },
  seed: 42,
};

function mergeConfig(partial?: Partial<BacktestConfig>): BacktestConfig {
  const cfg = {
    ...DEFAULT_BACKTEST_CONFIG,
    ...partial,
    costs: { ...BITGET_VIP0_FUTURES_COSTS, ...partial?.costs },
  };
  // Keep invalidationPct in sync when only one stop field is passed
  if (partial?.stopLossPct != null && partial.invalidationPct == null) {
    cfg.invalidationPct = partial.stopLossPct;
  }
  if (partial?.invalidationPct != null && partial.stopLossPct == null) {
    cfg.stopLossPct = partial.invalidationPct;
  }
  return cfg;
}

function applySlippage(px: number, side: "buy" | "sell", bps: number): number {
  const m = bps / 10_000;
  return side === "buy" ? px * (1 + m) : px * (1 - m);
}

function stopPrice(entry: number, side: "buy" | "sell", stopPct: number): number {
  return side === "buy" ? entry * (1 - stopPct) : entry * (1 + stopPct);
}

function takeProfitPrice(entry: number, side: "buy" | "sell", stopPct: number, rr: number): number {
  const risk = entry * stopPct;
  return side === "buy" ? entry + risk * rr : entry - risk * rr;
}

function limitTarget(signalClose: number, side: "buy" | "sell", offsetBps: number): number {
  const m = offsetBps / 10_000;
  // Better price: buy lower, sell higher
  return side === "buy" ? signalClose * (1 - m) : signalClose * (1 + m);
}

/** Conservative same-bar conflict: stop wins over TP (honest worst-case). */
function barHitsLevels(input: {
  side: "buy" | "sell";
  candle: Candle;
  stopPx: number;
  tpPx: number;
}): "stop_loss" | "take_profit" | null {
  const { side, candle, stopPx, tpPx } = input;
  if (side === "buy") {
    const hitStop = candle.low <= stopPx;
    const hitTp = candle.high >= tpPx;
    if (hitStop && hitTp) return "stop_loss";
    if (hitStop) return "stop_loss";
    if (hitTp) return "take_profit";
    return null;
  }
  const hitStop = candle.high >= stopPx;
  const hitTp = candle.low <= tpPx;
  if (hitStop && hitTp) return "stop_loss";
  if (hitStop) return "stop_loss";
  if (hitTp) return "take_profit";
  return null;
}

function barTouchesLimit(side: "buy" | "sell", candle: Candle, limitPx: number): boolean {
  if (side === "buy") return candle.low <= limitPx;
  return candle.high >= limitPx;
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
  stopLossPct: number;
  riskReward: number;
  entryType: "market" | "limit";
}): EntryAnalysis {
  const dir = input.side === "buy" ? "long" : "short";
  return {
    thesis: `${input.ticker} ${dir} on catalyst · move ${input.movePct.toFixed(2)}% · ${input.entryType} · R:R 1:${input.riskReward}`,
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
      `Stop-loss @ ${(input.stopLossPct * 100).toFixed(2)}% from entry (1R)`,
      `Take-profit @ ${input.riskReward}R or time-stop`,
    ],
    biasChecks: [
      "Wrote opposing (bear) case before entry",
      "Not revenge/FOMO — score gate + allowlist only",
      "Sunk-cost ignored — fixed size, pre-committed SL/TP",
    ],
    sessionRisk: `Backtest ${input.entryType} entry · SL/TP · Bitget VIP0 fees + AH-widened spread · rebates if configured · stop-first same-bar`,
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
  let stopExits = 0;
  let tpExits = 0;
  let unfilledLimits = 0;
  const pnls = trades.map((t) => t.realizedPnl);
  const rs = trades.map((t) => t.rMultiple);
  let grossPnlSum = 0;
  let totalFees = 0;
  let totalRebates = 0;
  let totalSpreadCost = 0;
  for (const t of trades) {
    if (t.exitReason === "stop_loss" || t.exitReason === "invalidation") stopExits += 1;
    if (t.exitReason === "take_profit") tpExits += 1;
    grossPnlSum += t.grossPnl;
    totalFees += t.feesPaid;
    totalRebates += t.rebatesEarned;
    totalSpreadCost += t.spreadCost;
    const p = t.realizedPnl;
    if (Math.abs(p) < 1e-10) flats += 1;
    else if (p > 0) {
      wins += 1;
      grossProfit += p;
    } else {
      losses += 1;
      grossLoss += Math.abs(p);
    }
  }
  for (const r of refusals) {
    if (r.gate === "limit-unfilled") unfilledLimits += 1;
  }
  const totalPnl = pnls.reduce((a, b) => a + b, 0);
  const avgWin = wins ? grossProfit / wins : 0;
  const avgLoss = losses ? grossLoss / losses : 0;
  const expectancy = trades.length ? totalPnl / trades.length : 0;
  const avgR = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0;
  const expectancyR = avgR;
  const winRate = trades.length ? wins / trades.length : 0;
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : null;
  const maxDrawdown = equityCurve.length
    ? Math.max(...equityCurve.map((e) => e.drawdown))
    : 0;

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
    expectancyR,
    avgWin,
    avgLoss,
    avgR,
    maxDrawdown,
    grossProfit,
    grossLoss,
    totalPnl,
    grossPnlSum,
    totalFees,
    totalRebates,
    totalSpreadCost,
    stopExits,
    tpExits,
    refusalCount: refusals.length,
    refusalRate: eventCount ? refusals.length / eventCount : 0,
    unfilledLimits,
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
  const config = mergeConfig(input.config);
  const candles = [...input.candles].sort((a, b) => a.ts - b.ts);
  const events = [...input.events]
    .filter((e) => e.symbol.toUpperCase() === input.symbol.toUpperCase())
    .sort((a, b) => a.ts - b.ts);

  const trades: BacktestTrade[] = [];
  const refusals: BacktestRefusal[] = [];
  const paperedTickers = new Set<string>();
  const sidesByTicker = new Map<string, "buy" | "sell">();
  const qty = Number(fixedPaperQuantity(config.fixedPaperSize));
  const stopPct = config.stopLossPct > 0 ? config.stopLossPct : config.invalidationPct;
  const rr = Math.max(0.5, config.riskReward);

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

    const chaseSide: "buy" | "sell" = movePct >= 0 ? "buy" : "sell";
    const side: "buy" | "sell" =
      config.directionMode === "fade_move"
        ? chaseSide === "buy"
          ? "sell"
          : "buy"
        : chaseSide;
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
      stopLossPct: stopPct,
      riskReward: rr,
      entryType: config.entryType,
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

    const signalClose = candles[idx]!.close;
    let entryIdx = idx;
    let entryPx = 0;
    let entryType = config.entryType;

    if (config.entryType === "limit") {
      const limitPx = limitTarget(signalClose, side, config.limitOffsetBps);
      let filled = false;
      const lastTry = Math.min(candles.length - 2, idx + config.limitTimeoutBars);
      for (let j = idx; j <= lastTry; j++) {
        if (barTouchesLimit(side, candles[j]!, limitPx)) {
          entryIdx = j;
          entryPx = limitPx; // limit fill at limit price (no adverse slip on limit)
          filled = true;
          break;
        }
      }
      if (!filled) {
        refusals.push({
          eventId: ev.id,
          ts: ev.ts,
          ticker: ev.ticker,
          reason: `Limit ${limitPx.toFixed(4)} unfilled in ${config.limitTimeoutBars} bars`,
          gate: "limit-unfilled",
        });
        continue;
      }
    } else {
      entryPx = applySlippage(signalClose, side, config.slippageBps);
      entryType = "market";
    }

    const stopPx = stopPrice(entryPx, side, stopPct);
    const tpPx = takeProfitPrice(entryPx, side, stopPct, rr);
    const riskPx = Math.abs(entryPx - stopPx);
    const rewardPx = Math.abs(tpPx - entryPx);

    let exitIdx = Math.min(candles.length - 1, entryIdx + config.holdBars);
    let exitReason: BacktestTrade["exitReason"] = "hold_bars";
    let exitPx = candles[exitIdx]!.close;
    if (exitIdx === candles.length - 1 && entryIdx + config.holdBars > exitIdx) {
      exitReason = "end_of_data";
    }

    for (let j = entryIdx + 1; j <= Math.min(candles.length - 1, entryIdx + config.holdBars); j++) {
      const hit = barHitsLevels({
        side,
        candle: candles[j]!,
        stopPx,
        tpPx,
      });
      if (hit === "stop_loss") {
        exitIdx = j;
        exitReason = "stop_loss";
        // Slippage through stop (estimated)
        exitPx = applySlippage(stopPx, side === "buy" ? "sell" : "buy", config.slippageBps);
        break;
      }
      if (hit === "take_profit") {
        exitIdx = j;
        exitReason = "take_profit";
        exitPx = tpPx; // limit-like TP fill
        break;
      }
      exitIdx = j;
      exitPx = candles[j]!.close;
    }

    if (exitReason === "hold_bars" || exitReason === "end_of_data") {
      exitPx = applySlippage(
        candles[exitIdx]!.close,
        side === "buy" ? "sell" : "buy",
        config.slippageBps,
      );
    }

    const grossPnl = computeLinearPnl({ side, entry: entryPx, exit: exitPx, qty });
    const exitKind =
      exitReason === "take_profit"
        ? ("take_profit" as const)
        : exitReason === "stop_loss"
          ? ("stop" as const)
          : ("time_exit" as const);
    const costs = computeRoundTripCosts({
      entryPrice: entryPx,
      exitPrice: exitPx,
      qty,
      entryKind: entryType,
      exitKind,
      costs: config.costs,
    });
    const realizedPnl = grossPnl - costs.totalCost;
    const rMultiple = riskPx > 0 ? realizedPnl / (riskPx * qty) : 0;

    const trade: BacktestTrade = {
      id: `bt_${ev.id}`,
      symbol: input.symbol.toUpperCase(),
      side,
      qty,
      entryType,
      entryTs: candles[entryIdx]!.ts,
      entryPx,
      stopPx,
      takeProfitPx: tpPx,
      riskPx,
      rewardPx,
      riskReward: rr,
      exitTs: candles[exitIdx]!.ts,
      exitPx,
      barsHeld: exitIdx - entryIdx,
      grossPnl,
      feesPaid: costs.feesPaid,
      rebatesEarned: costs.rebatesEarned,
      spreadCost: costs.spreadCost,
      realizedPnl,
      rMultiple,
      exitReason,
      score,
      headline: ev.headline,
      analysis,
      metricLabel: "estimated",
    };
    trades.push(trade);

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
      `paper-only backtest · candles observed · market/limit + SL/TP R:R · fees/spread/rebates estimated (VIP0 maker ${config.costs.makerFeeRate * 100}% / taker ${config.costs.takerFeeRate * 100}% · half-spread ${effectiveHalfSpreadBps(config.costs).toFixed(2)}bps) · stop-first same-bar · FENN · not financial advice`,
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
function headlineForTicker(ticker: string, bullish: boolean): string {
  const t = ticker.toUpperCase();
  if (t === "AMD") {
    return bullish
      ? "AMD MI300 / data-center AI GPU upgrade sparks after-hours rally"
      : "AMD guidance cut and semiconductor tariff risk spark after-hours selloff";
  }
  if (t === "NVDA") {
    return bullish
      ? "NVDA AI chip outlook upgrade sparks after-hours rally"
      : "NVDA guidance cut and tariff risk spark after-hours selloff";
  }
  return bullish
    ? `${t} AI chip outlook upgrade sparks after-hours rally`
    : `${t} guidance cut and tariff risk spark after-hours selloff`;
}

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
      headline: headlineForTicker(input.ticker, bullish),
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
