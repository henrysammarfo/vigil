/**
 * Live / fixture backtest runner (market|limit · SL/TP · R:R).
 * Usage:
 *   bun scripts/backtest-run.ts --symbol AMDUSDT
 *   bun scripts/backtest-run.ts --symbol AMDUSDT --entry limit --rr 2 --sl 0.012
 */
import { fetchBitgetHistoryCandles } from "../src/vigil/integrations/bitget-candles";
import {
  runWalkForwardBacktest,
  synthesizeEventsFromCandles,
  type BacktestResult,
} from "../src/vigil/agent/backtest";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

function summarize(res: BacktestResult) {
  const m = res.metrics;
  const exits = res.trades.reduce(
    (acc, t) => {
      acc[t.exitReason] = (acc[t.exitReason] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  return {
    symbol: res.symbol,
    entryType: res.config.entryType,
    stopLossPct: res.config.stopLossPct,
    riskReward: res.config.riskReward,
    candles: res.candleCount,
    events: res.eventCount,
    trades: m.trades,
    wins: m.wins,
    losses: m.losses,
    winRate: Number((m.winRate * 100).toFixed(1)),
    totalPnl: Number(m.totalPnl.toFixed(4)),
    grossPnl: Number(m.grossPnlSum.toFixed(4)),
    fees: Number(m.totalFees.toFixed(4)),
    rebates: Number(m.totalRebates.toFixed(4)),
    spreadCost: Number(m.totalSpreadCost.toFixed(4)),
    expectancy: Number(m.expectancy.toFixed(4)),
    expectancyR: Number(m.expectancyR.toFixed(3)),
    avgR: Number(m.avgR.toFixed(3)),
    profitFactor: m.profitFactor != null ? Number(m.profitFactor.toFixed(3)) : null,
    maxDrawdown: Number(m.maxDrawdown.toFixed(4)),
    stopExits: m.stopExits,
    tpExits: m.tpExits,
    unfilledLimits: m.unfilledLimits,
    costs: {
      makerFee: res.config.costs.makerFeeRate,
      takerFee: res.config.costs.takerFeeRate,
      makerRebate: res.config.costs.makerRebateRate,
      halfSpreadBps: res.config.costs.halfSpreadBps,
      ahSpreadMult: res.config.costs.ahSpreadMult,
      afterHours: res.config.costs.afterHours,
    },
    exitBreakdown: exits,
    sharpeLike: m.sharpeLike != null ? Number(m.sharpeLike.toFixed(3)) : null,
    refusals: m.refusalCount,
    refusalRate: Number((m.refusalRate * 100).toFixed(1)),
    walkForward: res.walkForward
      ? {
          trainTrades: res.walkForward.trainTrades,
          testTrades: res.walkForward.testTrades,
          trainPnl: Number(res.walkForward.train.totalPnl.toFixed(4)),
          testPnl: Number(res.walkForward.test.totalPnl.toFixed(4)),
          testWinRate: Number((res.walkForward.test.winRate * 100).toFixed(1)),
          testExpectancyR: Number(res.walkForward.test.expectancyR.toFixed(3)),
        }
      : null,
    sampleTrades: res.trades.slice(0, 5).map((t) => ({
      side: t.side,
      entryType: t.entryType,
      entry: Number(t.entryPx.toFixed(4)),
      sl: Number(t.stopPx.toFixed(4)),
      tp: Number(t.takeProfitPx.toFixed(4)),
      exit: Number(t.exitPx.toFixed(4)),
      reason: t.exitReason,
      R: Number(t.rMultiple.toFixed(3)),
      pnl: Number(t.realizedPnl.toFixed(4)),
      fees: Number(t.feesPaid.toFixed(4)),
      spread: Number(t.spreadCost.toFixed(4)),
      rebate: Number(t.rebatesEarned.toFixed(4)),
    })),
    honesty: res.honesty,
  };
}

async function main() {
  const symbol = arg("--symbol", "AMDUSDT").toUpperCase();
  const ticker = symbol.replace(/USDT$/, "");
  const bars = Number(arg("--bars", "480"));
  const granularity = arg("--granularity", "1H") as "1H" | "15m" | "4H";
  const entryType = (arg("--entry", "market") === "limit" ? "limit" : "market") as
    | "market"
    | "limit";
  const allow = arg("--allowlist", ticker)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  console.log("fetching candles", { symbol, bars, granularity, entryType });
  const candles = await fetchBitgetHistoryCandles({
    symbol,
    granularity,
    lookbackBars: bars,
  });
  if (candles.length < 40) {
    throw new Error(`Not enough candles: ${candles.length}`);
  }
  const events = synthesizeEventsFromCandles({
    symbol,
    ticker,
    candles,
    minAbsMovePct: Number(arg("--min-move", "1.0")),
    maxEvents: Number(arg("--max-events", "48")),
  });
  console.log("events", events.length, "candles", candles.length);

  const res = runWalkForwardBacktest({
    symbol,
    candles,
    events,
    config: {
      allowlist: allow,
      fennMode: true,
      minScore: Number(arg("--min-score", "40")),
      holdBars: Number(arg("--hold", "12")),
      stopLossPct: Number(arg("--sl", "0.012")),
      riskReward: Number(arg("--rr", "2")),
      entryType,
      limitOffsetBps: Number(arg("--limit-bps", "12")),
      limitTimeoutBars: Number(arg("--limit-timeout", "3")),
      slippageBps: Number(arg("--slippage-bps", "8")),
      costs: {
        halfSpreadBps: Number(arg("--half-spread-bps", "0.5")),
        ahSpreadMult: Number(arg("--ah-spread-mult", "3")),
        makerFeeRate: Number(arg("--maker-fee", "0.0002")),
        takerFeeRate: Number(arg("--taker-fee", "0.0006")),
        makerRebateRate: Number(arg("--maker-rebate", "0")),
        afterHours: arg("--rth", "0") !== "1",
      },
    },
    trainRatio: 0.7,
  });

  const summary = summarize(res);
  console.log(JSON.stringify(summary, null, 2));

  const outPath = `/opt/cursor/artifacts/vigil-backtest-${symbol}-${entryType}-${Date.now()}.json`;
  try {
    await Bun.write(
      outPath,
      JSON.stringify(
        {
          summary,
          trades: res.trades.slice(0, 40),
          equityCurve: res.equityCurve,
          refusals: res.refusals.slice(0, 40),
        },
        null,
        2,
      ),
    );
    console.log("wrote", outPath);
  } catch {
    console.log("artifact write skipped");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
