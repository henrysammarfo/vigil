/**
 * Serious paper growth book: $100 → $5,000 target.
 * Sizes from equity, never sprays Demo balance. Paper only.
 */
import { PAPER_BANKROLL_START_USD, type PaperBankroll } from "./paper-ledger";
import { HIGH_WR_PLAYBOOKS, type PairTicker } from "./playbooks/index";

/** Start capital (serious book). */
export const GROWTH_START_USD = PAPER_BANKROLL_START_USD;
/** Stretch target for the $100 book. */
export const GROWTH_TARGET_USD = 5_000;
/** Max fraction of equity risked per paper fill (estimated). */
export const GROWTH_RISK_FRACTION = 0.02;
/** Cap notional as fraction of equity (avoid oversized coin qty). */
export const GROWTH_NOTIONAL_FRACTION = 0.25;
/** Pairs cleared by high-WR lab for growth allowlist. */
export const GROWTH_ALLOWLIST: PairTicker[] = ["NVDA", "AMD", "AAPL", "TSLA"];

export type GrowthPlan = {
  startUsd: number;
  targetUsd: number;
  equityUsd: number;
  remainingUsd: number;
  progressPct: number;
  reachedTarget: boolean;
  riskBudgetUsd: number;
  qty: string;
  notionalUsd: number;
  sizeRule: string;
  metricLabel: "estimated";
};

export function growthProgress(bankroll: PaperBankroll): {
  progressPct: number;
  remainingUsd: number;
  reachedTarget: boolean;
} {
  const equity = bankroll.equityUsd;
  const remainingUsd = Math.max(0, GROWTH_TARGET_USD - equity);
  const progressPct = Math.min(
    100,
    Math.max(0, ((equity - GROWTH_START_USD) / (GROWTH_TARGET_USD - GROWTH_START_USD)) * 100),
  );
  return {
    progressPct,
    remainingUsd,
    reachedTarget: equity >= GROWTH_TARGET_USD,
  };
}

/**
 * Compute Demo paper qty from mark price + equity.
 * Fractional qty allowed (Bitget USDT-M stock perps). Floor at 0.01.
 */
export function computeGrowthSize(input: {
  equityUsd: number;
  markPrice: number;
  /** Playbook stop as decimal e.g. 0.015 */
  stopLossPct?: number;
  maxPositionUsd?: number;
}): GrowthPlan {
  const equityUsd = Math.max(0, input.equityUsd);
  const mark = input.markPrice > 0 ? input.markPrice : 0;
  const stop = input.stopLossPct && input.stopLossPct > 0 ? input.stopLossPct : 0.015;
  const progress = growthProgress({
    startUsd: GROWTH_START_USD,
    realizedPnl: equityUsd - GROWTH_START_USD,
    unrealizedPnl: 0,
    equityUsd,
    growthPct: 0,
    metricLabel: "estimated",
    note: "",
  });

  // After target: tiny maintenance size only (do not spray)
  const riskFrac = progress.reachedTarget ? GROWTH_RISK_FRACTION * 0.25 : GROWTH_RISK_FRACTION;
  const riskBudgetUsd = equityUsd * riskFrac;
  const notionalCap = Math.min(
    input.maxPositionUsd ?? GROWTH_TARGET_USD,
    Math.max(5, equityUsd * GROWTH_NOTIONAL_FRACTION),
  );
  // qty from stop-risk: risk ≈ qty * price * stop
  let qtyNum = mark > 0 ? riskBudgetUsd / (mark * stop) : 0.01;
  const notionalFromQty = qtyNum * mark;
  if (notionalFromQty > notionalCap && mark > 0) {
    qtyNum = notionalCap / mark;
  }
  // Clamp
  qtyNum = Math.max(0.01, Math.min(qtyNum, 10));
  // 2–4 decimal places depending on size
  const qty =
    qtyNum >= 1 ? qtyNum.toFixed(2) : qtyNum >= 0.1 ? qtyNum.toFixed(3) : qtyNum.toFixed(4);

  return {
    startUsd: GROWTH_START_USD,
    targetUsd: GROWTH_TARGET_USD,
    equityUsd,
    remainingUsd: progress.remainingUsd,
    progressPct: Number(progress.progressPct.toFixed(2)),
    reachedTarget: progress.reachedTarget,
    riskBudgetUsd: Number(riskBudgetUsd.toFixed(4)),
    qty,
    notionalUsd: Number((Number(qty) * mark).toFixed(4)),
    sizeRule: progress.reachedTarget
      ? `Target $${GROWTH_TARGET_USD} reached — maintenance size only (${qty}), never spray Demo balance`
      : `Grow $${GROWTH_START_USD}→$${GROWTH_TARGET_USD}: risk≈${(riskFrac * 100).toFixed(1)}% equity · qty ${qty} · stop ${(stop * 100).toFixed(1)}%`,
    metricLabel: "estimated",
  };
}

export function playbookStopForTicker(ticker: string): number {
  const pb = HIGH_WR_PLAYBOOKS[ticker.toUpperCase() as PairTicker];
  return pb?.config.stopLossPct ?? 0.015;
}

export function isGrowthAllowlisted(ticker: string, tenantAllowlist: string[]): boolean {
  const t = ticker.toUpperCase();
  if (!GROWTH_ALLOWLIST.includes(t as PairTicker)) return false;
  return tenantAllowlist.map((x) => x.toUpperCase()).includes(t);
}

export function growthThesisBlock(plan: GrowthPlan): string[] {
  return [
    `growth: equity $${plan.equityUsd.toFixed(2)} / target $${plan.targetUsd} (${plan.progressPct.toFixed(1)}%)`,
    plan.sizeRule,
    plan.reachedTarget
      ? "mission: target hit — protect book, selective paper only"
      : `mission: grow the $${plan.startUsd} serious book toward $${plan.targetUsd}`,
  ];
}
