import { describe, expect, it } from "vitest";
import {
  clearMemoryHotCache,
  evaluateLessonGuard,
  formatMemoryBlock,
  moveBucket,
  outcomeFromPnl,
  parseMovePctNumber,
  type MemoryPrior,
} from "../../src/vigil/agent/memory";

function prior(
  partial: Partial<MemoryPrior> & Pick<MemoryPrior, "outcome" | "realizedPnl">,
): MemoryPrior {
  return {
    id: partial.id ?? "x",
    ticker: partial.ticker ?? "NVDA",
    outcome: partial.outcome,
    movePct: partial.movePct ?? 1.5,
    realizedPnl: partial.realizedPnl,
    summary: partial.summary ?? "test",
    gate: partial.gate ?? "test",
    source: partial.source ?? "backtest",
    createdAt: partial.createdAt ?? new Date(),
  };
}

describe("fast smart memory", () => {
  it("parses move pct and buckets", () => {
    expect(parseMovePctNumber("+2.40%")).toBeCloseTo(2.4);
    expect(moveBucket(2.4)).toBe(2);
    expect(outcomeFromPnl(-1.2, "backtest")).toBe("backtest_loss");
    expect(outcomeFromPnl(0.5, "live")).toBe("win");
  });

  it("guards on bad expectancy", () => {
    clearMemoryHotCache();
    const priors = [
      prior({ outcome: "backtest_loss", realizedPnl: -1.5, createdAt: new Date(3) }),
      prior({ outcome: "backtest_loss", realizedPnl: -1.2, createdAt: new Date(2) }),
      prior({ outcome: "backtest_loss", realizedPnl: -0.8, createdAt: new Date(1) }),
    ];
    const g = evaluateLessonGuard(priors);
    expect(g.blockPaper).toBe(true);
    expect(g.gate).toMatch(/lesson-guard/);
  });

  it("passes when sample warm but expectancy ok", () => {
    const priors = [
      prior({ outcome: "backtest_win", realizedPnl: 2, createdAt: new Date(3) }),
      prior({ outcome: "backtest_win", realizedPnl: 1.5, createdAt: new Date(2) }),
      prior({ outcome: "backtest_loss", realizedPnl: -0.4, createdAt: new Date(1) }),
    ];
    const g = evaluateLessonGuard(priors);
    expect(g.blockPaper).toBe(false);
  });

  it("formats cited memory block for LLM/why-card", () => {
    const priors = [
      prior({
        outcome: "loss",
        realizedPnl: -1.1,
        summary: "spike fade after AI headline",
        source: "live",
      }),
    ];
    const lines = formatMemoryBlock({
      ticker: "NVDA",
      priors,
      closedSample: 1,
      expectancy: -1.1,
      winRate: 0,
      recentLossStreak: 1,
      guard: { blockPaper: false, reason: "warm", gate: "memory-warm" },
      blockLines: [],
      metricLabel: "observed",
    });
    expect(lines[0]).toMatch(/memory\[NVDA\]/);
    expect(lines.some((l) => l.includes("spike fade"))).toBe(true);
  });
});
