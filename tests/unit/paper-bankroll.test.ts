import { describe, expect, it } from "vitest";
import { computePaperBankroll, PAPER_BANKROLL_START_USD, paperScoreboard } from "../../src/vigil/agent/paper-ledger";

describe("paper $100 bankroll", () => {
  it("starts at 100 and grows with PnL", () => {
    expect(PAPER_BANKROLL_START_USD).toBe(100);
    const b = computePaperBankroll({ realizedPnlSum: 12.5, unrealizedPnlSum: -2 });
    expect(b.startUsd).toBe(100);
    expect(b.equityUsd).toBeCloseTo(110.5);
    expect(b.growthPct).toBeCloseTo(10.5);
  });

  it("attaches bankroll on scoreboard", () => {
    const sb = paperScoreboard([]);
    expect(sb.bankroll.equityUsd).toBe(100);
    expect(sb.bankroll.note.toLowerCase()).toContain("$100");
  });
});
