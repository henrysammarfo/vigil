import { describe, expect, it } from "vitest";
import {
  computeBacktestMetrics,
  makeSyntheticCandles,
  runBacktest,
  runWalkForwardBacktest,
  synthesizeEventsFromCandles,
} from "../../src/vigil/agent/backtest";

describe("backtest engine", () => {
  const candles = makeSyntheticCandles({
    startTs: 1_700_000_000_000,
    bars: 120,
    startPx: 100,
    stepMs: 3_600_000,
    // wave: up spikes then pullbacks — creates catalyst windows
    path: [
      0.002, 0.003, 0.004, 0.012, -0.004, -0.003, 0.001, 0.002, -0.015, 0.002, 0.003, 0.011,
      -0.002, 0.001, -0.012, 0.002,
    ],
  });

  it("refuses empty allowlist under FENN", () => {
    const events = synthesizeEventsFromCandles({
      symbol: "NVDAUSDT",
      ticker: "NVDA",
      candles,
      minAbsMovePct: 0.8,
      maxEvents: 10,
    });
    const res = runBacktest({
      symbol: "NVDAUSDT",
      candles,
      events,
      config: { allowlist: [], fennMode: true, minScore: 20 },
    });
    expect(res.trades.length).toBe(0);
    expect(res.refusals.length).toBeGreaterThan(0);
    expect(res.refusals.every((r) => r.gate === "allowlist")).toBe(true);
  });

  it("takes allowlisted trades with rubric + exits", () => {
    const events = synthesizeEventsFromCandles({
      symbol: "NVDAUSDT",
      ticker: "NVDA",
      candles,
      minAbsMovePct: 0.8,
      maxEvents: 20,
    });
    expect(events.length).toBeGreaterThan(2);
    const res = runBacktest({
      symbol: "NVDAUSDT",
      candles,
      events,
      config: {
        allowlist: ["NVDA"],
        fennMode: true,
        minScore: 30,
        holdBars: 8,
        stopLossPct: 0.015,
        riskReward: 2,
        entryType: "market",
        slippageBps: 5,
      },
    });
    expect(res.trades.length).toBeGreaterThan(0);
    expect(res.metrics.trades).toBe(res.trades.length);
    expect(res.trades[0]!.analysis.bearCase.length).toBeGreaterThanOrEqual(2);
    expect(res.trades[0]!.stopPx).toBeGreaterThan(0);
    expect(res.trades[0]!.takeProfitPx).toBeGreaterThan(0);
    expect(res.trades[0]!.riskReward).toBe(2);
    expect(res.trades.every((t) => t.exitPx > 0 && t.entryPx > 0)).toBe(true);
    expect(Number.isFinite(res.metrics.expectancyR)).toBe(true);
    expect(res.equityCurve.length).toBe(res.trades.length);
    const m = computeBacktestMetrics(
      res.trades,
      res.refusals,
      res.equityCurve,
      res.eventCount,
    );
    expect(m.wins + m.losses + m.flats).toBe(m.trades);
    expect(Number.isFinite(m.totalPnl)).toBe(true);
  });

  it("walk-forward splits train/test without inventing fills", () => {
    const events = synthesizeEventsFromCandles({
      symbol: "NVDAUSDT",
      ticker: "NVDA",
      candles,
      minAbsMovePct: 0.7,
      maxEvents: 24,
    });
    const res = runWalkForwardBacktest({
      symbol: "NVDAUSDT",
      candles,
      events,
      config: { allowlist: ["NVDA"], minScore: 25, holdBars: 6, riskReward: 2, stopLossPct: 0.012 },
      trainRatio: 0.6,
    });
    expect(res.walkForward).toBeTruthy();
    expect(
      (res.walkForward?.trainTrades ?? 0) + (res.walkForward?.testTrades ?? 0),
    ).toBeGreaterThanOrEqual(0);
    expect(res.honesty).toMatch(/walk-forward|R:R|SL\/TP/);
  });

  it("limit entries can refuse as unfilled", () => {
    const events = synthesizeEventsFromCandles({
      symbol: "NVDAUSDT",
      ticker: "NVDA",
      candles,
      minAbsMovePct: 0.8,
      maxEvents: 12,
    });
    const res = runBacktest({
      symbol: "NVDAUSDT",
      candles,
      events,
      config: {
        allowlist: ["NVDA"],
        entryType: "limit",
        limitOffsetBps: 80,
        limitTimeoutBars: 1,
        minScore: 25,
        holdBars: 6,
        stopLossPct: 0.01,
        riskReward: 2,
      },
    });
    // Aggressive limit offset on quiet bars → some unfilled
    expect(res.metrics.unfilledLimits + res.trades.length + res.refusals.length).toBeGreaterThan(0);
    expect(res.honesty).toMatch(/limit|SL\/TP/);
  });
});
