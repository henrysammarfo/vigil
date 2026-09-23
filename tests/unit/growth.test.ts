import { describe, expect, it } from "vitest";
import {
  computeGrowthSize,
  GROWTH_START_USD,
  GROWTH_TARGET_USD,
  growthProgress,
} from "../../src/vigil/agent/growth";
import { computePaperBankroll } from "../../src/vigil/agent/paper-ledger";

describe("growth $100 → $5000", () => {
  it("defines start and target", () => {
    expect(GROWTH_START_USD).toBe(100);
    expect(GROWTH_TARGET_USD).toBe(5000);
  });

  it("sizes fractional qty from equity and mark", () => {
    const plan = computeGrowthSize({
      equityUsd: 100,
      markPrice: 200,
      stopLossPct: 0.015,
    });
    expect(Number(plan.qty)).toBeGreaterThan(0);
    expect(Number(plan.qty)).toBeLessThan(1);
    expect(plan.notionalUsd).toBeLessThanOrEqual(100 * 0.25 + 0.01);
    expect(plan.reachedTarget).toBe(false);
  });

  it("marks target reached at 5000 equity", () => {
    const b = computePaperBankroll({ realizedPnlSum: 4900, unrealizedPnlSum: 0 });
    const g = growthProgress(b);
    expect(g.reachedTarget).toBe(true);
    expect(g.remainingUsd).toBe(0);
  });
});
