/**
 * Continuous AMD refine loop — local search around lab winners for a while.
 * Paper-only. Not financial advice.
 *
 *   bun scripts/amd-refine-loop.ts [--minutes 12]
 */
import { fetchBitgetHistoryCandles } from "../src/vigil/integrations/bitget-candles";
import {
  runWalkForwardBacktest,
  synthesizeEventsFromCandles,
  type BacktestConfig,
} from "../src/vigil/agent/backtest";
import { BITGET_VIP0_FUTURES_COSTS } from "../src/vigil/agent/trading-costs";

type Candles = Awaited<ReturnType<typeof fetchBitgetHistoryCandles>>;

type Trial = {
  name: string;
  tf: string;
  cfg: Partial<BacktestConfig>;
  minMove: number;
  testTrades: number;
  testWr: number;
  testPnl: number;
  testGross: number;
  testFees: number;
  testSpread: number;
  testER: number;
  testPf: number | null;
  trainPnl: number;
  robust: boolean;
  score: number;
};

function score(t: Omit<Trial, "score" | "robust" | "name" | "tf" | "cfg" | "minMove"> & {
  trainPnl: number;
  testPnl: number;
  testER: number;
  testPf: number | null;
  testTrades: number;
  testWr: number;
}): { score: number; robust: boolean } {
  if (t.testTrades < 4) return { score: -999, robust: false };
  const robust = t.trainPnl > 0 && t.testPnl > 0;
  const overfit =
    t.trainPnl < -10 && t.testPnl > 20
      ? -1.5
      : t.trainPnl > 15 && t.testPnl < 0
        ? -2
        : 0;
  const robustBonus = robust ? 1.2 : 0;
  return {
    score: t.testER * 3 + (t.testPf ?? 0) * 0.4 + t.testWr / 100 + robustBonus + overfit,
    robust,
  };
}

async function evalCfg(
  tf: string,
  candles: Candles,
  events: ReturnType<typeof synthesizeEventsFromCandles>,
  name: string,
  cfg: Partial<BacktestConfig>,
  minMove: number,
): Promise<Trial> {
  const res = runWalkForwardBacktest({
    symbol: "AMDUSDT",
    candles,
    events,
    config: {
      allowlist: ["AMD"],
      fennMode: true,
      costs: { ...BITGET_VIP0_FUTURES_COSTS, halfSpreadBps: 0.35, afterHours: true },
      ...cfg,
      costs: {
        ...BITGET_VIP0_FUTURES_COSTS,
        halfSpreadBps: 0.35,
        afterHours: true,
        ...cfg.costs,
      },
    },
    trainRatio: 0.7,
  });
  const test = res.walkForward?.test ?? res.metrics;
  const train = res.walkForward?.train;
  const base = {
    testTrades: test.trades,
    testWr: Number((test.winRate * 100).toFixed(1)),
    testPnl: Number(test.totalPnl.toFixed(4)),
    testGross: Number(test.grossPnlSum.toFixed(4)),
    testFees: Number(test.totalFees.toFixed(4)),
    testSpread: Number(test.totalSpreadCost.toFixed(4)),
    testER: Number(test.expectancyR.toFixed(3)),
    testPf: test.profitFactor != null ? Number(test.profitFactor.toFixed(3)) : null,
    trainPnl: Number((train?.totalPnl ?? 0).toFixed(4)),
  };
  const { score: sc, robust } = score(base);
  return {
    name,
    tf,
    cfg,
    minMove,
    ...base,
    robust,
    score: Number(sc.toFixed(3)),
  };
}

function jitter(seed: number): Partial<BacktestConfig> & { minMove: number } {
  // Deterministic-ish exploration around known good basins
  const entryType = seed % 5 === 0 ? "market" : "limit";
  const directionMode = seed % 7 === 0 ? "fade_move" : "with_move";
  const sls = [0.008, 0.01, 0.011, 0.012, 0.014, 0.015, 0.018];
  const rrs = [1.5, 2, 2.2, 2.5, 2.8, 3, 3.5];
  const holds = [8, 10, 12, 14, 16, 18, 24];
  const lbs = [6, 8, 10, 12, 14, 16, 20];
  const moves = [0.7, 0.9, 1.0, 1.2, 1.4, 1.6];
  return {
    entryType,
    directionMode,
    stopLossPct: sls[seed % sls.length]!,
    riskReward: rrs[(seed * 3) % rrs.length]!,
    holdBars: holds[(seed * 5) % holds.length]!,
    limitOffsetBps: lbs[(seed * 7) % lbs.length]!,
    limitTimeoutBars: 2 + (seed % 4),
    minScore: 35 + (seed % 4) * 5,
    slippageBps: 6 + (seed % 3) * 2,
    minMove: moves[(seed * 11) % moves.length]!,
  };
}

async function main() {
  const minutesArg = process.argv.find((a) => a.startsWith("--minutes"));
  const minutes = Number(
    minutesArg?.includes("=")
      ? minutesArg.split("=")[1]
      : process.argv[process.argv.indexOf("--minutes") + 1] ?? 12,
  );
  const deadline = Date.now() + Math.max(2, minutes) * 60_000;
  console.log(`AMD refine loop · ${minutes} min · cost-aware · until ${new Date(deadline).toISOString()}`);

  const datasets: Array<{ tf: string; candles: Candles; baseMove: number }> = [];
  for (const spec of [
    { granularity: "1H" as const, lookbackBars: 480, baseMove: 1.0 },
    { granularity: "1H" as const, lookbackBars: 720, baseMove: 1.0 },
    { granularity: "4H" as const, lookbackBars: 360, baseMove: 1.0 },
    { granularity: "15m" as const, lookbackBars: 600, baseMove: 0.8 },
  ]) {
    const candles = await fetchBitgetHistoryCandles({
      symbol: "AMDUSDT",
      granularity: spec.granularity,
      lookbackBars: spec.lookbackBars,
    });
    if (candles.length >= 80) {
      datasets.push({
        tf: `${spec.granularity}/${candles.length}`,
        candles,
        baseMove: spec.baseMove,
      });
      console.log("loaded", spec.granularity, candles.length);
    }
  }

  const trials: Trial[] = [];
  let best: Trial | null = null;
  let bestRobust: Trial | null = null;
  let n = 0;
  let seed = Date.now() % 10_000;

  while (Date.now() < deadline) {
    seed += 1;
    n += 1;
    const j = jitter(seed);
    const { minMove, ...cfg } = j;
    const ds = datasets[n % datasets.length]!;
    const events = synthesizeEventsFromCandles({
      symbol: "AMDUSDT",
      ticker: "AMD",
      candles: ds.candles,
      minAbsMovePct: minMove,
      maxEvents: 64,
    });
    const name = `${ds.tf}__${cfg.entryType}_${cfg.directionMode}_sl${cfg.stopLossPct}_rr${cfg.riskReward}_h${cfg.holdBars}_lb${cfg.limitOffsetBps}_m${minMove}`;
    const t = await evalCfg(ds.tf, ds.candles, events, name, cfg, minMove);
    trials.push(t);
    if (!best || t.score > best.score) best = t;
    if (t.robust && (!bestRobust || t.score > bestRobust.score)) bestRobust = t;
    if (n % 40 === 0) {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      console.log(
        `[${n}] left=${left}s best=${best?.score} ${best?.name?.slice(0, 70)} | robust=${bestRobust?.score ?? "—"}`,
      );
    }
  }

  trials.sort((a, b) => b.score - a.score);
  const top = trials.slice(0, 25).map(({ cfg: _c, ...rest }) => rest);
  const report = {
    ranAt: new Date().toISOString(),
    minutes,
    trials: n,
    best: best ? { ...best, cfg: best.cfg } : null,
    bestRobust: bestRobust ? { ...bestRobust, cfg: bestRobust.cfg } : null,
    top,
    costs: { ...BITGET_VIP0_FUTURES_COSTS, halfSpreadBps: 0.35, afterHours: true },
    honesty:
      "paper-only continuous refine · VIP0 fees+AH spread · robust=train&test>0 · not financial advice",
  };

  const path = `/opt/cursor/artifacts/vigil-amd-refine-${Date.now()}.json`;
  await Bun.write(path, JSON.stringify(report, null, 2));
  await Bun.write(
    "/workspace/docs/memory/research-raw/AMD_REFINE_LATEST.json",
    JSON.stringify(report, null, 2),
  );
  console.log("\n=== BEST ===", JSON.stringify(best, null, 2));
  console.log("\n=== BEST ROBUST (train&test>0) ===", JSON.stringify(bestRobust, null, 2));
  console.log("wrote", path);
  console.log("DONE trials=", n);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
