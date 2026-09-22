/**
 * Live / fixture backtest runner.
 * Usage:
 *   bun scripts/backtest-run.ts
 *   bun scripts/backtest-run.ts --symbol NVDAUSDT --bars 480 --granularity 1H
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
  return {
    symbol: res.symbol,
    candles: res.candleCount,
    events: res.eventCount,
    trades: m.trades,
    wins: m.wins,
    losses: m.losses,
    winRate: Number((m.winRate * 100).toFixed(1)),
    totalPnl: Number(m.totalPnl.toFixed(4)),
    expectancy: Number(m.expectancy.toFixed(4)),
    profitFactor: m.profitFactor != null ? Number(m.profitFactor.toFixed(3)) : null,
    maxDrawdown: Number(m.maxDrawdown.toFixed(4)),
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
        }
      : null,
    honesty: res.honesty,
  };
}

async function main() {
  const symbol = arg("--symbol", "NVDAUSDT").toUpperCase();
  const ticker = symbol.replace(/USDT$/, "");
  const bars = Number(arg("--bars", "360"));
  const granularity = arg("--granularity", "1H") as "1H" | "15m" | "4H";
  const allow = arg("--allowlist", ticker)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  console.log("fetching candles", { symbol, bars, granularity });
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
      holdBars: Number(arg("--hold", "8")),
      invalidationPct: Number(arg("--invalidation", "0.015")),
      slippageBps: Number(arg("--slippage-bps", "8")),
    },
    trainRatio: 0.7,
  });

  const summary = summarize(res);
  console.log(JSON.stringify(summary, null, 2));

  const outPath = `/opt/cursor/artifacts/vigil-backtest-${symbol}-${Date.now()}.json`;
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
