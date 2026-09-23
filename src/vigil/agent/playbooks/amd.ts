/**
 * AMD closed-window playbook — learned from walk-forward labs (2026-09-23).
 * Paper / Demo only. Not financial advice.
 */

import type { BacktestConfig } from "../backtest";
import { DEFAULT_BACKTEST_CONFIG } from "../backtest";

export type AmdStrategyId =
  | "amd_limit_pullback_rr2"
  | "amd_market_rr2"
  | "amd_fade_limit_rr2"
  | "amd_limit_tight_rr25";

export type AmdPlaybookEntry = {
  id: AmdStrategyId;
  label: string;
  thesis: string;
  config: Partial<BacktestConfig>;
  /** OOS notes from lab — estimated */
  labNotes: string;
  rank: number;
};

/**
 * Ranked AMD strategies from Bitget 1H history labs.
 * Prefer limit pullback with 1.2% SL / 1:2 RR (best OOS E[R] in lab).
 */
export const AMD_PLAYBOOK: AmdPlaybookEntry[] = [
  {
    id: "amd_limit_tight_rr25",
    label: "AMD limit · SL 1.0% · RR 1:2.5",
    thesis:
      "Best lab OOS: limit pullback on MI300/data-center catalyst, tight 1R stop, 2.5R target.",
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
    },
    labNotes:
      "1H×480 WF OOS 8t · 62.5% WR · E[R]≈+0.77 · PF≈2.92 · train≈+33 (lab 2026-09-23)",
    rank: 1,
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
    },
    labNotes: "1H×480 WF OOS ~8t · 62.5% WR · E[R]≈+0.55 · PF≈2.4",
    rank: 2,
  },
  {
    id: "amd_market_rr2",
    label: "AMD market · SL 1.2% · RR 1:2",
    thesis: "Immediate market entry on Watch+ AMD move with fixed R:R — accept AH slippage.",
    config: {
      allowlist: ["AMD"],
      entryType: "market",
      stopLossPct: 0.012,
      riskReward: 2,
      holdBars: 12,
      minScore: 40,
      directionMode: "with_move",
      slippageBps: 8,
    },
    labNotes: "1H×480 WF OOS ~10t · 40% WR · E[R]≈+0.15 · PF≈1.3",
    rank: 3,
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
    },
    labNotes: "Lab: fade usually underperforms with_move on this AMD tape — keep as contingency",
    rank: 4,
  },
];

export function bestAmdConfig(): Partial<BacktestConfig> {
  const top = AMD_PLAYBOOK[0]!;
  return { ...DEFAULT_BACKTEST_CONFIG, ...top.config };
}

export function amdPlaybookSummary(): string[] {
  return AMD_PLAYBOOK.map(
    (p) => `#${p.rank} ${p.id}: ${p.thesis} · ${p.labNotes}`,
  );
}

/** Memory seed lines for AMD (estimated from lab — cite in LLM priors). */
export function amdMemorySeedLines(): string[] {
  return [
    "memory[AMD]: best lab = limit pullback SL1.0% RR1:2.5 (OOS E[R]≈+0.77 PF≈2.9)",
    "prior: backtest_win AMD limit · MI300/data-center catalyst · TP@2.5R [backtest]",
    "prior: with_move >> fade_move on current AMD 1H tape [backtest]",
    "prior: backtest_loss AMD 15m market chase · train+/test− overfit — avoid 15m spray [backtest]",
    "prior: unfilled limits are features (discipline) not bugs",
  ];
}
