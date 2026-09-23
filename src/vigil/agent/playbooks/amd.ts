/**
 * AMD closed-window playbook — learned from walk-forward labs (2026-09-23).
 * Paper / Demo only. Not financial advice.
 */

import type { BacktestConfig } from "../backtest";
import { DEFAULT_BACKTEST_CONFIG } from "../backtest";
import { BITGET_VIP0_FUTURES_COSTS } from "../trading-costs";

export type AmdStrategyId =
  | "amd_limit_pullback_rr2"
  | "amd_market_rr2"
  | "amd_fade_limit_rr2"
  | "amd_limit_tight_rr25"
  | "amd_limit_sl08_rr3"
  | "amd_limit_sl14_rr3_hold24"
  | "amd_4h_limit_rr3";

export type AmdPlaybookEntry = {
  id: AmdStrategyId;
  label: string;
  thesis: string;
  config: Partial<BacktestConfig>;
  /** OOS notes from lab — estimated */
  labNotes: string;
  rank: number;
};

const VIP0_AMD_COSTS = {
  ...BITGET_VIP0_FUTURES_COSTS,
  halfSpreadBps: 0.35,
  afterHours: true,
  makerFeeRate: 0.0002,
  takerFeeRate: 0.0006,
  makerRebateRate: 0,
} as const;

/**
 * Ranked AMD strategies from Bitget history labs (net of VIP0 fees + AH spread).
 * Prefer configs where train AND test are positive (robust).
 */
export const AMD_PLAYBOOK: AmdPlaybookEntry[] = [
  {
    id: "amd_limit_sl14_rr3_hold24",
    label: "AMD limit · SL 1.4% · RR 1:3 · hold 24",
    thesis:
      "Refine-loop robust champ: shallow limit pullback (6bps), wider 1.4% stop, 3R target, longer hold — train&test both green after costs.",
    config: {
      allowlist: ["AMD"],
      entryType: "limit",
      limitOffsetBps: 6,
      limitTimeoutBars: 3,
      stopLossPct: 0.014,
      riskReward: 3,
      holdBars: 24,
      minScore: 40,
      directionMode: "with_move",
      slippageBps: 10,
      costs: { ...VIP0_AMD_COSTS },
    },
    labNotes:
      "1H×480 refine ~10M trials · train≈+13.1 · OOS 10t 40% · net +52.9 · E[R]≈+0.70 · fees≈3.7 · spread≈0.37 (2026-09-23)",
    rank: 1,
  },
  {
    id: "amd_limit_sl08_rr3",
    label: "AMD limit · SL 0.8% · RR 1:3",
    thesis:
      "High-WR robust alternate: tighter 0.8% stop, 3R target — better win rate / E[R], lower absolute PnL.",
    config: {
      allowlist: ["AMD"],
      entryType: "limit",
      limitOffsetBps: 12,
      limitTimeoutBars: 3,
      stopLossPct: 0.008,
      riskReward: 3,
      holdBars: 12,
      minScore: 40,
      directionMode: "with_move",
      slippageBps: 8,
      costs: { ...VIP0_AMD_COSTS },
    },
    labNotes:
      "1H×480 WF · train≈+18.7 · OOS 8t 62.5% · net +33.8 · E[R]≈+0.91 · fees≈3.0 (lab long 2026-09-23)",
    rank: 2,
  },
  {
    id: "amd_limit_tight_rr25",
    label: "AMD limit · SL 1.0% · RR 1:2.5",
    thesis: "Prior 1H winner — still strong OOS after VIP0 costs; slightly wider stop.",
    config: {
      allowlist: ["AMD"],
      entryType: "limit",
      limitOffsetBps: 12,
      limitTimeoutBars: 3,
      stopLossPct: 0.01,
      riskReward: 2.5,
      holdBars: 12,
      minScore: 40,
      directionMode: "with_move",
      slippageBps: 8,
      costs: { ...VIP0_AMD_COSTS },
    },
    labNotes:
      "1H×480 WF OOS 8t · 62.5% WR · net +32.1 · E[R]≈+0.69 · fees 3.02 (lab 2026-09-23)",
    rank: 3,
  },
  {
    id: "amd_4h_limit_rr3",
    label: "AMD 4H limit · SL 1.2% · RR 1:3",
    thesis:
      "Swing TF: higher OOS PnL but train was red — treat as exploratory, require live confirmation.",
    config: {
      allowlist: ["AMD"],
      entryType: "limit",
      limitOffsetBps: 12,
      limitTimeoutBars: 3,
      stopLossPct: 0.012,
      riskReward: 3,
      holdBars: 18,
      minScore: 40,
      directionMode: "with_move",
      slippageBps: 8,
      costs: { ...VIP0_AMD_COSTS },
    },
    labNotes:
      "4H×360 WF OOS 14t · net +96 · E[R]≈+1.10 · BUT train≈−37 — not robust yet",
    rank: 4,
  },
  {
    id: "amd_limit_pullback_rr2",
    label: "AMD limit pullback · SL 1.2% · RR 1:2",
    thesis:
      "Chase named semi catalyst only after a small limit pullback; pre-commit 1R stop and 2R target.",
    config: {
      allowlist: ["AMD"],
      entryType: "limit",
      limitOffsetBps: 12,
      limitTimeoutBars: 3,
      stopLossPct: 0.012,
      riskReward: 2,
      holdBars: 12,
      minScore: 40,
      directionMode: "with_move",
      slippageBps: 8,
      costs: { ...VIP0_AMD_COSTS },
    },
    labNotes: "1H×480 WF · solid baseline RR2 after costs",
    rank: 5,
  },
  {
    id: "amd_market_rr2",
    label: "AMD market · SL 1.2% · RR 1:2",
    thesis: "Immediate market entry on Watch+ AMD move with fixed R:R — pay taker+spread.",
    config: {
      allowlist: ["AMD"],
      entryType: "market",
      stopLossPct: 0.012,
      riskReward: 2,
      holdBars: 12,
      minScore: 40,
      directionMode: "with_move",
      slippageBps: 8,
      costs: { ...VIP0_AMD_COSTS },
    },
    labNotes: "Underperforms limit after taker+AH spread drag",
    rank: 6,
  },
  {
    id: "amd_fade_limit_rr2",
    label: "AMD fade spike · limit · RR 1:2",
    thesis: "Mean-revert exhausted AH spike when memory shows chase expectancy negative.",
    config: {
      allowlist: ["AMD"],
      entryType: "limit",
      limitOffsetBps: 8,
      stopLossPct: 0.012,
      riskReward: 2,
      holdBars: 10,
      minScore: 45,
      directionMode: "fade_move",
      costs: { ...VIP0_AMD_COSTS },
    },
    labNotes: "Lab: fade usually underperforms with_move on this AMD tape — contingency only",
    rank: 7,
  },
];

export function bestAmdConfig(): Partial<BacktestConfig> {
  const top = AMD_PLAYBOOK[0]!;
  return { ...DEFAULT_BACKTEST_CONFIG, ...top.config };
}

export function amdPlaybookSummary(): string[] {
  return AMD_PLAYBOOK.map((p) => `#${p.rank} ${p.id}: ${p.thesis} · ${p.labNotes}`);
}

/** Memory seed lines for AMD (estimated from lab — cite in LLM priors). */
export function amdMemorySeedLines(): string[] {
  return [
    "memory[AMD]: refine champ = limit SL1.4% RR1:3 hold24 lb6 · train&test>0 · OOS net≈+53 after VIP0 fees+AH spread",
    "prior: high-WR alternate = limit SL0.8% RR1:3 · OOS E[R]≈+0.91 WR≈62% (prefer when needing discipline)",
    "prior: Bitget VIP0 futures · maker 0.02% · taker 0.06% · limit/TP=maker · market/stop=taker",
    "prior: AMD observed half-spread ~0.3–0.6 bps RTH; AH model ×3 in backtest",
    "prior: 4H limit RR3 prints big OOS but train red — do not promote without confirmation",
    "prior: with_move >> fade_move on current AMD tape [backtest]",
    "prior: unfilled limits save taker+spread — discipline not a bug",
  ];
}
