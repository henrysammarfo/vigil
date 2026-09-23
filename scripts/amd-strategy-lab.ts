/**
 * AMD strategy lab — sweep market/limit × RR × SL × fade/chase on Bitget history.
 * Writes ranked report + updates artifacts. Paper-only. Not financial advice.
 *
 *   bun scripts/amd-strategy-lab.ts
 */
import { fetchBitgetHistoryCandles } from "../src/vigil/integrations/bitget-candles";
import {
  runWalkForwardBacktest,
  synthesizeEventsFromCandles,
  type BacktestConfig,
  type BacktestResult,
} from "../src/vigil/agent/backtest";
import { AMD_PLAYBOOK, amdPlaybookSummary } from "../src/vigil/agent/playbooks/amd";

type Row = {
  name: string;
  entryType: string;
  directionMode: string;
  sl: number;
  rr: number;
  hold: number;
  minMove: number;
  testTrades: number;
  testWr: number;
  testPnl: number;
  testER: number;
  testPf: number | null;
  trainPnl: number;
  score: number;
};

function scoreOos(r: BacktestResult): number {
  const m = r.walkForward?.test ?? r.metrics;
  if (m.trades < 3) return -999;
  // Prefer positive E[R], PF, and not too few trades; penalize train>>test blowups
  const trainPnl = r.walkForward?.train.totalPnl ?? 0;
  const overfitPenalty =
    trainPnl > 5 && m.totalPnl < 0 ? -2 : trainPnl > 10 && m.expectancyR < 0 ? -1.5 : 0;
  return m.expectancyR * 3 + (m.profitFactor ?? 0) * 0.4 + m.winRate + overfitPenalty;
}

async function runOne(
  candles: Awaited<ReturnType<typeof fetchBitgetHistoryCandles>>,
  events: ReturnType<typeof synthesizeEventsFromCandles>,
  name: string,
  cfg: Partial<BacktestConfig>,
): Promise<{ row: Row; res: BacktestResult }> {
  const res = runWalkForwardBacktest({
    symbol: "AMDUSDT",
    candles,
    events,
    config: {
      allowlist: ["AMD"],
      fennMode: true,
      ...cfg,
    },
    trainRatio: 0.7,
  });
  const test = res.walkForward?.test ?? res.metrics;
  const train = res.walkForward?.train;
  const row: Row = {
    name,
    entryType: res.config.entryType,
    directionMode: res.config.directionMode,
    sl: res.config.stopLossPct,
    rr: res.config.riskReward,
    hold: res.config.holdBars,
    minMove: 0,
    testTrades: test.trades,
    testWr: Number((test.winRate * 100).toFixed(1)),
    testPnl: Number(test.totalPnl.toFixed(4)),
    testER: Number(test.expectancyR.toFixed(3)),
    testPf: test.profitFactor != null ? Number(test.profitFactor.toFixed(3)) : null,
    trainPnl: Number((train?.totalPnl ?? 0).toFixed(4)),
    score: Number(scoreOos(res).toFixed(3)),
  };
  return { row, res };
}

async function main() {
  const bars = 480;
  console.log("AMD lab · fetching 1H candles", bars);
  const candles = await fetchBitgetHistoryCandles({
    symbol: "AMDUSDT",
    granularity: "1H",
    lookbackBars: bars,
  });
  if (candles.length < 80) throw new Error(`candles ${candles.length}`);

  const events = synthesizeEventsFromCandles({
    symbol: "AMDUSDT",
    ticker: "AMD",
    candles,
    minAbsMovePct: 1.0,
    maxEvents: 48,
  });
  console.log("candles", candles.length, "events", events.length);
  console.log("playbook seeds:\n", amdPlaybookSummary().join("\n"));

  const grid: Array<{ name: string; cfg: Partial<BacktestConfig>; minMove?: number }> = [];

  for (const entryType of ["market", "limit"] as const) {
    for (const directionMode of ["with_move", "fade_move"] as const) {
      for (const sl of [0.01, 0.012, 0.015]) {
        for (const rr of [1.5, 2, 2.5]) {
          grid.push({
            name: `${entryType}_${directionMode}_sl${sl}_rr${rr}`,
            cfg: {
              entryType,
              directionMode,
              stopLossPct: sl,
              riskReward: rr,
              holdBars: 12,
              minScore: 40,
              limitOffsetBps: 12,
              limitTimeoutBars: 3,
              slippageBps: 8,
            },
          });
        }
      }
    }
  }

  // Named playbook entries
  for (const p of AMD_PLAYBOOK) {
    grid.push({ name: `playbook_${p.id}`, cfg: p.config });
  }

  const rows: Row[] = [];
  let best: { row: Row; res: BacktestResult } | null = null;

  for (const g of grid) {
    const ev =
      g.minMove != null
        ? synthesizeEventsFromCandles({
            symbol: "AMDUSDT",
            ticker: "AMD",
            candles,
            minAbsMovePct: g.minMove,
            maxEvents: 48,
          })
        : events;
    const out = await runOne(candles, ev, g.name, g.cfg);
    rows.push(out.row);
    if (!best || out.row.score > best.row.score) best = out;
  }

  rows.sort((a, b) => b.score - a.score);
  const top = rows.slice(0, 12);
  console.log("\n=== TOP AMD OOS (by score) ===");
  console.log(JSON.stringify(top, null, 2));
  console.log("\n=== BEST ===");
  console.log(JSON.stringify(best?.row, null, 2));

  const report = {
    ranAt: new Date().toISOString(),
    symbol: "AMDUSDT",
    granularity: "1H",
    bars: candles.length,
    events: events.length,
    gridSize: grid.length,
    top,
    best: best?.row ?? null,
    bestSampleTrades: best?.res.trades.slice(0, 8).map((t) => ({
      side: t.side,
      entryType: t.entryType,
      entry: t.entryPx,
      sl: t.stopPx,
      tp: t.takeProfitPx,
      exit: t.exitPx,
      reason: t.exitReason,
      R: t.rMultiple,
      pnl: t.realizedPnl,
    })),
    playbook: AMD_PLAYBOOK.map((p) => ({ id: p.id, rank: p.rank, labNotes: p.labNotes })),
    honesty:
      "paper-only · observed candles · estimated PnL · walk-forward OOS ranking · not financial advice",
  };

  const path = `/opt/cursor/artifacts/vigil-amd-strategy-lab-${Date.now()}.json`;
  await Bun.write(path, JSON.stringify(report, null, 2));
  console.log("wrote", path);

  // Also write stable path for docs
  await Bun.write(
    "/workspace/docs/memory/research-raw/AMD_STRATEGY_LAB_LATEST.json",
    JSON.stringify(report, null, 2),
  );
  console.log("wrote docs/memory/research-raw/AMD_STRATEGY_LAB_LATEST.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
