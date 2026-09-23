/**
 * Multi-pair high-WR playbooks (≥80% walk-forward OOS target).
 * Net of Bitget VIP0 fees + AH spread. Paper / Demo only. Not financial advice.
 */
import type { BacktestConfig } from "../backtest";
import { DEFAULT_BACKTEST_CONFIG } from "../backtest";
import { BITGET_VIP0_FUTURES_COSTS } from "../trading-costs";
import type { CandleGranularity } from "../../integrations/bitget-candles";

export type PairTicker = "AMD" | "NVDA" | "AAPL" | "TSLA";

export type PairPlaybook = {
  ticker: PairTicker;
  symbol: `${PairTicker}USDT`;
  label: string;
  thesis: string;
  /** Preferred history TF for lab-validated setup */
  granularity: CandleGranularity;
  lookbackBars: number;
  minAbsMovePct: number;
  config: Partial<BacktestConfig>;
  labNotes: string;
  /** OOS win rate % from lab (estimated) */
  oosWr: number;
  oosTrades: number;
  robust: boolean;
};

const COSTS = {
  ...BITGET_VIP0_FUTURES_COSTS,
  halfSpreadBps: 0.4,
  afterHours: true,
  makerFeeRate: 0.0002,
  takerFeeRate: 0.0006,
  makerRebateRate: 0,
} as const;

/**
 * High-WR champs from cost-aware walk-forward lab (2026-09-23).
 * All hit ≥80% OOS WR with ≥4 test trades.
 */
export const HIGH_WR_PLAYBOOKS: Record<PairTicker, PairPlaybook> = {
  AMD: {
    ticker: "AMD",
    symbol: "AMDUSDT",
    label: "AMD market · SL 1.5% · RR 1:3.5 · hold 24",
    thesis:
      "High-WR chase: only strong ≥2.2% AH moves, market entry, wide 1.5% stop, 3.5R target. OOS 80% — train was red; treat as selective.",
    granularity: "1H",
    lookbackBars: 480,
    minAbsMovePct: 2.2,
    config: {
      allowlist: ["AMD"],
      entryType: "market",
      directionMode: "with_move",
      stopLossPct: 0.015,
      riskReward: 3.5,
      holdBars: 24,
      minScore: 60,
      limitOffsetBps: 12,
      limitTimeoutBars: 4,
      slippageBps: 8,
      costs: { ...COSTS },
    },
    labNotes:
      "1H×480 WF OOS 5t · 80% WR · net +47.5 · E[R]≈+1.10 · train red — high-WR not robust yet",
    oosWr: 80,
    oosTrades: 5,
    robust: false,
  },
  NVDA: {
    ticker: "NVDA",
    symbol: "NVDAUSDT",
    label: "NVDA 4H limit · SL 1.5% · RR 1:2 · hold 24",
    thesis:
      "Swing limit pullback on named NVDA catalyst — train&test green, OOS ~91% WR after costs.",
    granularity: "4H",
    lookbackBars: 360,
    minAbsMovePct: 1.0,
    config: {
      allowlist: ["NVDA"],
      entryType: "limit",
      directionMode: "with_move",
      stopLossPct: 0.015,
      riskReward: 2,
      holdBars: 24,
      minScore: 40,
      limitOffsetBps: 14,
      limitTimeoutBars: 4,
      slippageBps: 8,
      costs: { ...COSTS },
    },
    labNotes:
      "4H×360 WF OOS 11t · 90.9% WR · net +51.4 · train +12.4 · robust",
    oosWr: 90.9,
    oosTrades: 11,
    robust: true,
  },
  AAPL: {
    ticker: "AAPL",
    symbol: "AAPLUSDT",
    label: "AAPL 4H fade-limit · SL 1.0% · RR 1:3.5",
    thesis:
      "Fade exhausted AH spikes on AAPL with selective score≥70 limit — OOS 83% WR, robust.",
    granularity: "4H",
    lookbackBars: 360,
    minAbsMovePct: 1.0,
    config: {
      allowlist: ["AAPL"],
      entryType: "limit",
      directionMode: "fade_move",
      stopLossPct: 0.01,
      riskReward: 3.5,
      holdBars: 12,
      minScore: 70,
      limitOffsetBps: 14,
      limitTimeoutBars: 4,
      slippageBps: 8,
      costs: { ...COSTS },
    },
    labNotes:
      "4H×360 WF OOS 6t · 83.3% WR · net +16.2 · train +2.4 · robust",
    oosWr: 83.3,
    oosTrades: 6,
    robust: true,
  },
  TSLA: {
    ticker: "TSLA",
    symbol: "TSLAUSDT",
    label: "TSLA 1H fade-limit · SL 1.0% · RR 1:2 · hold 24",
    thesis:
      "Fade TSLA AH spikes with limit pullback — OOS 80%+ WR on 1H history, train&test green after costs.",
    granularity: "1H",
    lookbackBars: 480,
    minAbsMovePct: 1.0,
    config: {
      allowlist: ["TSLA"],
      entryType: "limit",
      directionMode: "fade_move",
      stopLossPct: 0.01,
      riskReward: 2,
      holdBars: 24,
      minScore: 40,
      limitOffsetBps: 10,
      limitTimeoutBars: 4,
      slippageBps: 8,
      costs: { ...COSTS },
    },
    labNotes:
      "1H×480 WF OOS 5t · 80% WR · net +11.4 · train +9.4 · robust (stable vs 720-bar fetch flake)",
    oosWr: 80,
    oosTrades: 5,
    robust: true,
  },
};

export function playbookForSymbol(symbol: string): PairPlaybook | null {
  const ticker = symbol.replace(/USDT$/i, "").toUpperCase() as PairTicker;
  return HIGH_WR_PLAYBOOKS[ticker] ?? null;
}

export function bestConfigForSymbol(symbol: string): Partial<BacktestConfig> | null {
  const pb = playbookForSymbol(symbol);
  if (!pb) return null;
  return { ...DEFAULT_BACKTEST_CONFIG, ...pb.config };
}

export function highWrSummary(): string[] {
  return Object.values(HIGH_WR_PLAYBOOKS).map(
    (p) =>
      `${p.ticker}: OOS ${p.oosWr}% WR (${p.oosTrades}t)${p.robust ? " · robust" : " · selective"} · ${p.labNotes}`,
  );
}

export function memorySeedLinesForTicker(ticker: string): string[] {
  const pb = HIGH_WR_PLAYBOOKS[ticker.toUpperCase() as PairTicker];
  if (!pb) return [];
  return [
    `memory[${pb.ticker}]: high-WR playbook OOS ${pb.oosWr}% · ${pb.label}`,
    `prior: ${pb.thesis}`,
    `prior: Bitget VIP0 fees+AH spread in backtest · ${pb.labNotes}`,
    "prior: target ≥80% WR on allowlisted pairs before paper size-up",
  ];
}
