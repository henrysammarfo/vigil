import { describe, expect, it } from "vitest";
import {
  BITGET_VIP0_FUTURES_COSTS,
  computeLegCost,
  computeRoundTripCosts,
  effectiveHalfSpreadBps,
  roleForFill,
} from "../../src/vigil/agent/trading-costs";

describe("trading costs", () => {
  it("uses VIP0 maker/taker rates and widens AH spread", () => {
    expect(BITGET_VIP0_FUTURES_COSTS.makerFeeRate).toBeCloseTo(0.0002);
    expect(BITGET_VIP0_FUTURES_COSTS.takerFeeRate).toBeCloseTo(0.0006);
    const ah = effectiveHalfSpreadBps({ ...BITGET_VIP0_FUTURES_COSTS, halfSpreadBps: 0.5, afterHours: true });
    const rth = effectiveHalfSpreadBps({
      ...BITGET_VIP0_FUTURES_COSTS,
      halfSpreadBps: 0.5,
      afterHours: false,
    });
    expect(ah).toBeGreaterThan(rth);
  });

  it("charges taker on market/stop and maker on limit/TP", () => {
    expect(roleForFill({ kind: "market" })).toBe("taker");
    expect(roleForFill({ kind: "stop" })).toBe("taker");
    expect(roleForFill({ kind: "limit" })).toBe("maker");
    expect(roleForFill({ kind: "take_profit" })).toBe("maker");
  });

  it("applies rebate as credit on maker legs", () => {
    const leg = computeLegCost({
      price: 100,
      qty: 10,
      role: "maker",
      costs: { ...BITGET_VIP0_FUTURES_COSTS, makerRebateRate: 0.00005, afterHours: false },
      applySpread: false,
    });
    expect(leg.fee).toBeCloseTo(100 * 10 * 0.0002);
    expect(leg.rebate).toBeCloseTo(100 * 10 * 0.00005);
    expect(leg.total).toBeCloseTo(leg.fee - leg.rebate);
  });

  it("round-trip market→stop costs more than limit→TP", () => {
    const mkt = computeRoundTripCosts({
      entryPrice: 600,
      exitPrice: 595,
      qty: 1,
      entryKind: "market",
      exitKind: "stop",
      costs: { ...BITGET_VIP0_FUTURES_COSTS, halfSpreadBps: 0.5, afterHours: true },
    });
    const lim = computeRoundTripCosts({
      entryPrice: 600,
      exitPrice: 610,
      qty: 1,
      entryKind: "limit",
      exitKind: "take_profit",
      costs: { ...BITGET_VIP0_FUTURES_COSTS, halfSpreadBps: 0.5, afterHours: true },
    });
    expect(mkt.totalCost).toBeGreaterThan(lim.totalCost);
    expect(mkt.entry.role).toBe("taker");
    expect(lim.entry.role).toBe("maker");
    expect(lim.exit.spreadCost).toBe(0);
  });
});
