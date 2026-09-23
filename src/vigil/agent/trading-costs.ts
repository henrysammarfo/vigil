/**
 * Bitget USDT-FUTURES trading costs — spread, fees, rebates.
 * Defaults = VIP 0 retail (fact-checked Bitget Fee Center / FAQ 2026):
 *   maker 0.02% · taker 0.06%
 * Market-maker rebate is optional (negative maker rate) — default 0 for Demo retail.
 * Not financial advice. Fees labeled estimated unless pulled from live Fee Center.
 */

export type LiquidityRole = "maker" | "taker";

export type TradingCostConfig = {
  /** Half bid-ask spread in bps (one-way cross). Observed AMD ~0.3 bps RTH; AH wider. */
  halfSpreadBps: number;
  /** Multiply half-spread for closed-window / after-hours honesty. */
  ahSpreadMult: number;
  /** VIP0 futures maker fee as fraction (0.0002 = 0.02%). */
  makerFeeRate: number;
  /** VIP0 futures taker fee as fraction (0.0006 = 0.06%). */
  takerFeeRate: number;
  /**
   * Maker rebate as positive fraction paid back (e.g. 0.00005 = 0.5 bps).
   * Set 0 for retail Demo. MM Tier1 Group B futures ≈ 0.0001 (1 bp) — only if entitled.
   */
  makerRebateRate: number;
  /** Treat session as after-hours (widen spread). */
  afterHours: boolean;
};

/** Bitget VIP 0 USDT-M perpetual defaults (estimated / schedule). */
export const BITGET_VIP0_FUTURES_COSTS: TradingCostConfig = {
  halfSpreadBps: 0.5,
  ahSpreadMult: 3,
  makerFeeRate: 0.0002,
  takerFeeRate: 0.0006,
  makerRebateRate: 0,
  afterHours: true,
};

export type LegCost = {
  role: LiquidityRole;
  notional: number;
  spreadCost: number;
  fee: number;
  rebate: number;
  /** fee - rebate + spread */
  total: number;
  metricLabel: "estimated";
};

export type RoundTripCosts = {
  entry: LegCost;
  exit: LegCost;
  feesPaid: number;
  rebatesEarned: number;
  spreadCost: number;
  totalCost: number;
  metricLabel: "estimated";
};

export function effectiveHalfSpreadBps(cfg: TradingCostConfig): number {
  const base = Math.max(0, cfg.halfSpreadBps);
  return cfg.afterHours ? base * Math.max(1, cfg.ahSpreadMult) : base;
}

export function roleForFill(input: {
  kind: "market" | "limit" | "stop" | "take_profit" | "time_exit";
}): LiquidityRole {
  if (input.kind === "limit" || input.kind === "take_profit") return "maker";
  return "taker";
}

export function computeLegCost(input: {
  price: number;
  qty: number;
  role: LiquidityRole;
  costs: TradingCostConfig;
  /** Market/stop crosses spread; limit/TP at own price does not add half-spread. */
  applySpread: boolean;
}): LegCost {
  const notional = Math.abs(input.price * input.qty);
  const half = effectiveHalfSpreadBps(input.costs) / 10_000;
  const spreadCost = input.applySpread ? notional * half : 0;
  let fee = 0;
  let rebate = 0;
  if (input.role === "taker") {
    fee = notional * input.costs.takerFeeRate;
  } else {
    fee = notional * input.costs.makerFeeRate;
    rebate = notional * Math.max(0, input.costs.makerRebateRate);
  }
  return {
    role: input.role,
    notional,
    spreadCost,
    fee,
    rebate,
    total: fee - rebate + spreadCost,
    metricLabel: "estimated",
  };
}

export function computeRoundTripCosts(input: {
  entryPrice: number;
  exitPrice: number;
  qty: number;
  entryKind: "market" | "limit";
  exitKind: "stop" | "take_profit" | "time_exit";
  costs: TradingCostConfig;
}): RoundTripCosts {
  const entryRole = roleForFill({ kind: input.entryKind });
  const exitRole = roleForFill({
    kind:
      input.exitKind === "take_profit"
        ? "take_profit"
        : input.exitKind === "stop"
          ? "stop"
          : "time_exit",
  });
  const entry = computeLegCost({
    price: input.entryPrice,
    qty: input.qty,
    role: entryRole,
    costs: input.costs,
    applySpread: input.entryKind === "market",
  });
  const exit = computeLegCost({
    price: input.exitPrice,
    qty: input.qty,
    role: exitRole,
    costs: input.costs,
    applySpread: input.exitKind !== "take_profit",
  });
  const feesPaid = entry.fee + exit.fee;
  const rebatesEarned = entry.rebate + exit.rebate;
  const spreadCost = entry.spreadCost + exit.spreadCost;
  return {
    entry,
    exit,
    feesPaid,
    rebatesEarned,
    spreadCost,
    totalCost: feesPaid - rebatesEarned + spreadCost,
    metricLabel: "estimated",
  };
}

/** Apply half-spread into fill price (worsens entry/exit). */
export function applyHalfSpreadToPrice(
  px: number,
  side: "buy" | "sell",
  halfSpreadBps: number,
): number {
  const m = halfSpreadBps / 10_000;
  return side === "buy" ? px * (1 + m) : px * (1 - m);
}
