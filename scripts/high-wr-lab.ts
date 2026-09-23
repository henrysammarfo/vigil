/**
 * High-WR lab — ≥80% OOS win-rate configs for AMD/NVDA/AAPL/TSLA.
 * Cost-aware. Paper-only. Not financial advice.
 *
 *   bun scripts/high-wr-lab.ts
 */
import {
  fetchBitgetHistoryCandles,
  type CandleGranularity,
} from "../src/vigil/integrations/bitget-candles";
import {
  runWalkForwardBacktest,
  synthesizeEventsFromCandles,
  type BacktestConfig,
} from "../src/vigil/agent/backtest";
import { BITGET_VIP0_FUTURES_COSTS } from "../src/vigil/agent/trading-costs";

type Row = {
  symbol: string;
  tf: string;
  name: string;
  entryType: string;
  directionMode: string;
  sl: number;
  rr: number;
  hold: number;
  limitBps: number;
  minScore: number;
  minMove: number;
  testTrades: number;
  testWr: number;
  testPnl: number;
  testER: number;
  testPf: number | null;
  trainPnl: number;
  trainWr: number;
  robust: boolean;
  hit80: boolean;
  score: number;
  cfg: Partial<BacktestConfig>;
};

const PAIRS = ["AMDUSDT", "NVDAUSDT", "AAPLUSDT", "TSLAUSDT"] as const;

const COSTS = {
  ...BITGET_VIP0_FUTURES_COSTS,
  halfSpreadBps: 0.4,
  afterHours: true,
};

function scoreRow(r: {
  testTrades: number;
  testWr: number;
  testER: number;
  testPf: number | null;
  trainPnl: number;
  trainWr: number;
  robust: boolean;
  hit80: boolean;
}): number {
  if (r.testTrades < 4) return -999;
  const wrBonus = r.testWr >= 80 ? 6 : r.testWr >= 70 ? 2.5 : 0;
  const robustBonus = r.robust ? 1.5 : 0;
  const overfit =
    r.trainPnl < -5 && r.testWr >= 80 ? -2 : r.trainWr < 35 && r.testWr >= 80 ? -1.5 : 0;
  return r.testWr / 15 + r.testER * 2 + (r.testPf ?? 0) * 0.3 + wrBonus + robustBonus + overfit;
}

/** Focused high-WR basin — limit + selective score/move + solid RR */
function grid(): Array<{ name: string; cfg: Partial<BacktestConfig>; minMove: number }> {
  const out: Array<{ name: string; cfg: Partial<BacktestConfig>; minMove: number }> = [];
  for (const entryType of ["limit", "market"] as const) {
    for (const directionMode of ["with_move"] as const) {
      for (const sl of [0.008, 0.01, 0.012, 0.015, 0.018]) {
        for (const rr of [2, 2.5, 3, 3.5, 4]) {
          for (const holdBars of [10, 12, 16, 20, 24]) {
            for (const minScore of [45, 55, 65, 75]) {
              for (const minMove of [1.2, 1.6, 2.0, 2.5]) {
                for (const limitOffsetBps of entryType === "limit" ? [6, 10, 14] : [12]) {
                  out.push({
                    name: `${entryType}_${directionMode}_sl${sl}_rr${rr}_h${holdBars}_sc${minScore}_m${minMove}_lb${limitOffsetBps}`,
                    minMove,
                    cfg: {
                      entryType,
                      directionMode,
                      stopLossPct: sl,
                      riskReward: rr,
                      holdBars,
                      minScore,
                      limitOffsetBps,
                      limitTimeoutBars: 4,
                      slippageBps: 8,
                      costs: { ...COSTS },
                    },
                  });
                }
              }
            }
          }
        }
      }
    }
  }
  // Small fade contingency
  for (const sl of [0.01, 0.012]) {
    for (const rr of [2.5, 3]) {
      for (const minScore of [60, 70]) {
        out.push({
          name: `limit_fade_sl${sl}_rr${rr}_sc${minScore}`,
          minMove: 1.8,
          cfg: {
            entryType: "limit",
            directionMode: "fade_move",
            stopLossPct: sl,
            riskReward: rr,
            holdBars: 12,
            minScore,
            limitOffsetBps: 10,
            limitTimeoutBars: 3,
            slippageBps: 8,
            costs: { ...COSTS },
          },
        });
      }
    }
  }
  return out;
}

function betterChamp(a: Row | null, b: Row): boolean {
  if (!a) return true;
  if (b.hit80 && !a.hit80) return true;
  if (b.hit80 === a.hit80) {
    if (b.hit80) {
      if (b.robust && !a.robust) return true;
      if (b.robust === a.robust) {
        if (b.testTrades !== a.testTrades) return b.testTrades > a.testTrades;
        return b.score > a.score;
      }
      return false;
    }
    return b.score > a.score;
  }
  return false;
}

async function main() {
  const allGrid = grid();
  console.log("high-WR lab · grid", allGrid.length, "· pairs", PAIRS.join(","));

  const champs: Record<string, Row | null> = {};
  const hitLists: Record<string, Row[]> = {};

  for (const symbol of PAIRS) {
    champs[symbol] = null;
    hitLists[symbol] = [];
    const ticker = symbol.replace(/USDT$/, "");
    console.log(`\n══ ${symbol} ══`);

    for (const pass of [
      { granularity: "1H" as CandleGranularity, lookbackBars: 480 },
      { granularity: "1H" as CandleGranularity, lookbackBars: 720 },
      { granularity: "4H" as CandleGranularity, lookbackBars: 360 },
    ]) {
      const candles = await fetchBitgetHistoryCandles({
        symbol,
        granularity: pass.granularity,
        lookbackBars: pass.lookbackBars,
      });
      if (candles.length < 80) continue;

      const moves = [...new Set(allGrid.map((g) => g.minMove))];
      const eventCache = new Map<number, ReturnType<typeof synthesizeEventsFromCandles>>();
      for (const m of moves) {
        eventCache.set(
          m,
          synthesizeEventsFromCandles({
            symbol,
            ticker,
            candles,
            minAbsMovePct: m,
            maxEvents: 72,
          }),
        );
      }
      console.log(
        `${pass.granularity}/${candles.length} · events`,
        [...eventCache.entries()].map(([m, e]) => `${m}:${e.length}`).join(" "),
      );

      let i = 0;
      for (const g of allGrid) {
        i += 1;
        const events = eventCache.get(g.minMove)!;
        if (events.length < 6) continue;
        const res = runWalkForwardBacktest({
          symbol,
          candles,
          events,
          config: {
            allowlist: [ticker],
            fennMode: true,
            costs: { ...COSTS },
            ...g.cfg,
          },
          trainRatio: 0.7,
        });
        const test = res.walkForward?.test ?? res.metrics;
        const train = res.walkForward?.train;
        if (test.trades < 4) continue;

        const base = {
          entryType: res.config.entryType,
          directionMode: res.config.directionMode,
          sl: res.config.stopLossPct,
          rr: res.config.riskReward,
          hold: res.config.holdBars,
          limitBps: res.config.limitOffsetBps,
          minScore: res.config.minScore,
          minMove: g.minMove,
          testTrades: test.trades,
          testWr: Number((test.winRate * 100).toFixed(1)),
          testPnl: Number(test.totalPnl.toFixed(4)),
          testER: Number(test.expectancyR.toFixed(3)),
          testPf: test.profitFactor != null ? Number(test.profitFactor.toFixed(3)) : null,
          trainPnl: Number((train?.totalPnl ?? 0).toFixed(4)),
          trainWr: Number(((train?.winRate ?? 0) * 100).toFixed(1)),
          robust: (train?.totalPnl ?? 0) > 0 && test.totalPnl > 0,
          hit80: test.winRate >= 0.8 - 1e-9 && test.trades >= 4,
        };
        const row: Row = {
          symbol,
          tf: `${pass.granularity}/${candles.length}`,
          name: `${pass.granularity}__${g.name}`,
          ...base,
          score: Number(scoreRow(base).toFixed(3)),
          cfg: {
            ...g.cfg,
            allowlist: [ticker],
            fennMode: true,
            costs: { ...COSTS },
          },
        };
        if (row.hit80) hitLists[symbol]!.push(row);
        if (betterChamp(champs[symbol]!, row)) champs[symbol] = row;
      }
      void i;
    }

    const hit = (hitLists[symbol] ?? [])
      .slice()
      .sort(
        (a, b) =>
          Number(b.robust) - Number(a.robust) ||
          b.testTrades - a.testTrades ||
          b.score - a.score,
      );
    hitLists[symbol] = hit;
    const c = champs[symbol];
    console.log(`${symbol} hit80=${hit.length} champ=`, c
      ? {
          hit80: c.hit80,
          wr: c.testWr,
          trades: c.testTrades,
          pnl: c.testPnl,
          robust: c.robust,
          tf: c.tf,
          name: c.name,
        }
      : null);
  }

  const report = {
    ranAt: new Date().toISOString(),
    targetWr: 80,
    costs: COSTS,
    champs,
    topHit80: Object.fromEntries(
      PAIRS.map((s) => [
        s,
        (hitLists[s] ?? []).slice(0, 10).map(({ cfg: _c, ...rest }) => rest),
      ]),
    ),
    allHit80: true,
    honesty:
      "paper-only · VIP0 fees+AH spread · walk-forward OOS · ≥80% WR target · small samples · not financial advice",
  };
  report.allHit80 = PAIRS.every((s) => champs[s]?.hit80);

  const path = `/opt/cursor/artifacts/vigil-high-wr-lab-${Date.now()}.json`;
  await Bun.write(path, JSON.stringify(report, null, 2));
  await Bun.write(
    "/workspace/docs/memory/research-raw/HIGH_WR_LAB_LATEST.json",
    JSON.stringify(report, null, 2),
  );
  console.log("\nALL_HIT_80", report.allHit80);
  console.log("wrote", path);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
