/**
 * AMD strategy lab — long cost-aware sweep (fees/spread/rebates).
 * Paper-only. Not financial advice.
 *
 *   bun scripts/amd-strategy-lab.ts
 *   bun scripts/amd-strategy-lab.ts --long   # wider grid + multi TF
 */
import { fetchBitgetHistoryCandles, type CandleGranularity } from "../src/vigil/integrations/bitget-candles";
import {
  runWalkForwardBacktest,
  synthesizeEventsFromCandles,
  type BacktestConfig,
  type BacktestResult,
} from "../src/vigil/agent/backtest";
import { AMD_PLAYBOOK, amdPlaybookSummary } from "../src/vigil/agent/playbooks/amd";
import { BITGET_VIP0_FUTURES_COSTS } from "../src/vigil/agent/trading-costs";

type Row = {
  name: string;
  tf: string;
  bars: number;
  entryType: string;
  directionMode: string;
  sl: number;
  rr: number;
  hold: number;
  limitBps: number;
  minMove: number;
  testTrades: number;
  testWr: number;
  testPnl: number;
  testGross: number;
  testFees: number;
  testSpread: number;
  testRebates: number;
  testER: number;
  testPf: number | null;
  trainPnl: number;
  score: number;
};

function scoreOos(r: BacktestResult): number {
  const m = r.walkForward?.test ?? r.metrics;
  if (m.trades < 3) return -999;
  const trainPnl = r.walkForward?.train.totalPnl ?? 0;
  const overfitPenalty =
    trainPnl > 5 && m.totalPnl < 0 ? -2 : trainPnl > 10 && m.expectancyR < 0 ? -1.5 : 0;
  // Prefer net E[R] after costs; light bonus for fee efficiency (limit)
  const feeDrag = m.grossPnlSum !== 0 ? Math.abs(m.totalFees + m.totalSpreadCost) / Math.max(1, Math.abs(m.grossPnlSum)) : 0;
  return m.expectancyR * 3 + (m.profitFactor ?? 0) * 0.4 + m.winRate - feeDrag * 0.3 + overfitPenalty;
}

async function runOne(
  symbol: string,
  tf: string,
  candles: Awaited<ReturnType<typeof fetchBitgetHistoryCandles>>,
  events: ReturnType<typeof synthesizeEventsFromCandles>,
  name: string,
  cfg: Partial<BacktestConfig>,
): Promise<{ row: Row; res: BacktestResult }> {
  const res = runWalkForwardBacktest({
    symbol,
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
  const row: Row = {
    name,
    tf,
    bars: candles.length,
    entryType: res.config.entryType,
    directionMode: res.config.directionMode,
    sl: res.config.stopLossPct,
    rr: res.config.riskReward,
    hold: res.config.holdBars,
    limitBps: res.config.limitOffsetBps,
    minMove: 0,
    testTrades: test.trades,
    testWr: Number((test.winRate * 100).toFixed(1)),
    testPnl: Number(test.totalPnl.toFixed(4)),
    testGross: Number(test.grossPnlSum.toFixed(4)),
    testFees: Number(test.totalFees.toFixed(4)),
    testSpread: Number(test.totalSpreadCost.toFixed(4)),
    testRebates: Number(test.totalRebates.toFixed(4)),
    testER: Number(test.expectancyR.toFixed(3)),
    testPf: test.profitFactor != null ? Number(test.profitFactor.toFixed(3)) : null,
    trainPnl: Number((train?.totalPnl ?? 0).toFixed(4)),
    score: Number(scoreOos(res).toFixed(3)),
  };
  return { row, res };
}

function buildGrid(long: boolean): Array<{
  name: string;
  cfg: Partial<BacktestConfig>;
  minMove?: number;
}> {
  const grid: Array<{ name: string; cfg: Partial<BacktestConfig>; minMove?: number }> = [];
  const entries = ["market", "limit"] as const;
  const dirs = ["with_move", "fade_move"] as const;
  const sls = long ? [0.008, 0.01, 0.012, 0.015, 0.02] : [0.01, 0.012, 0.015];
  const rrs = long ? [1.5, 2, 2.5, 3] : [1.5, 2, 2.5];
  const holds = long ? [8, 12, 18] : [12];
  const limitBpsList = long ? [8, 12, 18] : [12];

  for (const entryType of entries) {
    for (const directionMode of dirs) {
      for (const sl of sls) {
        for (const rr of rrs) {
          for (const holdBars of holds) {
            const bpsOpts = entryType === "limit" ? limitBpsList : [12];
            for (const limitOffsetBps of bpsOpts) {
              grid.push({
                name: `${entryType}_${directionMode}_sl${sl}_rr${rr}_h${holdBars}_lb${limitOffsetBps}`,
                cfg: {
                  entryType,
                  directionMode,
                  stopLossPct: sl,
                  riskReward: rr,
                  holdBars,
                  minScore: 40,
                  limitOffsetBps,
                  limitTimeoutBars: 3,
                  slippageBps: 8,
                },
              });
            }
          }
        }
      }
    }
  }

  // Cost sensitivity on champion shape
  for (const rebate of [0, 0.00005]) {
    for (const half of [0.35, 0.8, 1.5]) {
      grid.push({
        name: `cost_sens_limit_rebate${rebate}_hs${half}`,
        cfg: {
          entryType: "limit",
          directionMode: "with_move",
          stopLossPct: 0.01,
          riskReward: 2.5,
          holdBars: 12,
          limitOffsetBps: 12,
          limitTimeoutBars: 3,
          slippageBps: 8,
          costs: {
            ...BITGET_VIP0_FUTURES_COSTS,
            halfSpreadBps: half,
            afterHours: true,
            makerRebateRate: rebate,
          },
        },
      });
    }
  }

  for (const p of AMD_PLAYBOOK) {
    grid.push({ name: `playbook_${p.id}`, cfg: p.config });
  }

  if (long) {
    for (const minMove of [0.8, 1.0, 1.4]) {
      grid.push({
        name: `limit_with_move_sl0.01_rr2.5_move${minMove}`,
        minMove,
        cfg: {
          entryType: "limit",
          directionMode: "with_move",
          stopLossPct: 0.01,
          riskReward: 2.5,
          holdBars: 12,
          limitOffsetBps: 12,
          limitTimeoutBars: 3,
          slippageBps: 8,
        },
      });
    }
  }

  return grid;
}

async function sweepTf(input: {
  granularity: CandleGranularity;
  lookbackBars: number;
  long: boolean;
  allRows: Row[];
  bestRef: { current: { row: Row; res: BacktestResult } | null };
}) {
  const symbol = "AMDUSDT";
  console.log(`\n── TF ${input.granularity} × ${input.lookbackBars} bars ──`);
  const candles = await fetchBitgetHistoryCandles({
    symbol,
    granularity: input.granularity,
    lookbackBars: input.lookbackBars,
  });
  if (candles.length < 80) {
    console.log("skip — not enough candles", candles.length);
    return;
  }
  const baseEvents = synthesizeEventsFromCandles({
    symbol,
    ticker: "AMD",
    candles,
    minAbsMovePct: 1.0,
    maxEvents: input.long ? 64 : 48,
  });
  console.log("candles", candles.length, "events", baseEvents.length);

  const grid = buildGrid(input.long);
  console.log("grid size", grid.length);
  let i = 0;
  for (const g of grid) {
    i += 1;
    if (i % 25 === 0 || i === 1) {
      console.log(`[${input.granularity}] ${i}/${grid.length} … best so far ${input.bestRef.current?.row.name ?? "—"} score=${input.bestRef.current?.row.score ?? "—"}`);
    }
    const ev =
      g.minMove != null
        ? synthesizeEventsFromCandles({
            symbol,
            ticker: "AMD",
            candles,
            minAbsMovePct: g.minMove,
            maxEvents: input.long ? 64 : 48,
          })
        : baseEvents;
    const out = await runOne(
      symbol,
      `${input.granularity}/${candles.length}`,
      candles,
      ev,
      `${input.granularity}__${g.name}`,
      g.cfg,
    );
    out.row.minMove = g.minMove ?? 1.0;
    input.allRows.push(out.row);
    if (!input.bestRef.current || out.row.score > input.bestRef.current.row.score) {
      input.bestRef.current = out;
    }
  }
}

async function main() {
  const long = process.argv.includes("--long");
  console.log("AMD lab · cost-aware · long=", long);
  console.log("playbook seeds:\n", amdPlaybookSummary().join("\n"));

  const allRows: Row[] = [];
  const bestRef: { current: { row: Row; res: BacktestResult } | null } = { current: null };

  const passes: Array<{ granularity: CandleGranularity; lookbackBars: number }> = long
    ? [
        { granularity: "1H", lookbackBars: 480 },
        { granularity: "1H", lookbackBars: 720 },
        { granularity: "15m", lookbackBars: 600 },
        { granularity: "4H", lookbackBars: 360 },
      ]
    : [{ granularity: "1H", lookbackBars: 480 }];

  for (const p of passes) {
    await sweepTf({ ...p, long, allRows, bestRef });
  }

  allRows.sort((a, b) => b.score - a.score);
  const top = allRows.slice(0, 20);
  console.log("\n=== TOP AMD OOS (net of fees/spread) ===");
  console.log(JSON.stringify(top, null, 2));
  console.log("\n=== BEST ===");
  console.log(JSON.stringify(bestRef.current?.row, null, 2));

  const report = {
    ranAt: new Date().toISOString(),
    symbol: "AMDUSDT",
    long,
    passes,
    gridRuns: allRows.length,
    costsDefault: {
      ...BITGET_VIP0_FUTURES_COSTS,
      halfSpreadBps: 0.35,
      afterHours: true,
    },
    top,
    best: bestRef.current?.row ?? null,
    bestSampleTrades: bestRef.current?.res.trades.slice(0, 10).map((t) => ({
      side: t.side,
      entryType: t.entryType,
      entry: t.entryPx,
      sl: t.stopPx,
      tp: t.takeProfitPx,
      exit: t.exitPx,
      reason: t.exitReason,
      R: Number(t.rMultiple.toFixed(3)),
      gross: Number(t.grossPnl.toFixed(4)),
      fees: Number(t.feesPaid.toFixed(4)),
      spread: Number(t.spreadCost.toFixed(4)),
      rebate: Number(t.rebatesEarned.toFixed(4)),
      pnl: Number(t.realizedPnl.toFixed(4)),
    })),
    playbook: AMD_PLAYBOOK.map((p) => ({ id: p.id, rank: p.rank, labNotes: p.labNotes })),
    honesty:
      "paper-only · observed candles · VIP0 fees + AH spread estimated · walk-forward OOS · not financial advice",
  };

  const path = `/opt/cursor/artifacts/vigil-amd-strategy-lab-${Date.now()}.json`;
  await Bun.write(path, JSON.stringify(report, null, 2));
  console.log("wrote", path);
  await Bun.write(
    "/workspace/docs/memory/research-raw/AMD_STRATEGY_LAB_LATEST.json",
    JSON.stringify(report, null, 2),
  );
  console.log("wrote docs/memory/research-raw/AMD_STRATEGY_LAB_LATEST.json");
  console.log("DONE gridRuns=", allRows.length, "best=", bestRef.current?.row.name);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
