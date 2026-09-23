import { describe, expect, it } from "vitest";
import { scoreFromMove, stateFromScore } from "../../src/vigil/agent/signal";

describe("signal scoring", () => {
  it("maps ~1.3%+ named catalyst into Watch+", () => {
    const score = scoreFromMove(1.35, "Nvidia AI chip export guidance update", 2.5);
    expect(score).toBeGreaterThanOrEqual(40);
    expect(stateFromScore(score)).not.toBe("Rejected");
  });

  it("maps ~2% TSLA session into Review territory with catalyst", () => {
    const score = scoreFromMove(2.13, "Tesla delivery miss sparks tariff fears", 2.6);
    expect(score).toBeGreaterThanOrEqual(60);
    expect(["Review", "Qualified"]).toContain(stateFromScore(score));
  });

  it("rejects tiny quiet moves without catalyst", () => {
    const score = scoreFromMove(0.2, "Markets calm ahead of open", 0.4);
    expect(stateFromScore(score)).toBe("Rejected");
  });

  it("boosts AMD MI300 / semiconductor catalysts", () => {
    const score = scoreFromMove(1.4, "AMD MI300 data-center AI GPU upgrade", 2.2);
    expect(score).toBeGreaterThanOrEqual(40);
    expect(stateFromScore(score)).not.toBe("Rejected");
  });
});
