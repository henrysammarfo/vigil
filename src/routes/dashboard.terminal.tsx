import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Play, RefreshCw } from "lucide-react";
import { DashboardShell, Panel } from "@/components/vigil/dashboard-shell";
import { Button } from "@/components/ui/button";
import { runBacktestFn, memoryDigestFn, terminalSnapshotFn } from "@/api/dashboard";

export const Route = createFileRoute("/dashboard/terminal")({
  head: () => ({
    meta: [
      { title: "Trade Terminal — VIGIL" },
      {
        name: "description",
        content: "Paper trade chart terminal with mark PnL and rigorous backtest.",
      },
    ],
  }),
  component: Terminal,
});

const SYMBOLS = ["NVDAUSDT", "AAPLUSDT", "TSLAUSDT"] as const;

function fmt(n: number | null | undefined, d = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(d)}`;
}

function Terminal() {
  const qc = useQueryClient();
  const [symbol, setSymbol] = useState<(typeof SYMBOLS)[number]>("NVDAUSDT");
  const [granularity, setGranularity] = useState<"15m" | "1H" | "4H">("15m");
  const [btBusy, setBtBusy] = useState(false);
  const [btMsg, setBtMsg] = useState<string | null>(null);
  const [backtest, setBacktest] = useState<null | {
    metrics: {
      trades: number;
      wins: number;
      losses: number;
      winRate: number;
      totalPnl: number;
      expectancy: number;
      profitFactor: number | null;
      maxDrawdown: number;
      sharpeLike: number | null;
      refusalRate: number;
    };
    walkForward: null | {
      trainTrades: number;
      testTrades: number;
      train: { totalPnl: number; winRate: number };
      test: { totalPnl: number; winRate: number };
    };
    equityCurve: Array<{ ts: number; equity: number; drawdown: number }>;
    trades: Array<{
      id: string;
      side: string;
      entryTs: number;
      exitTs: number;
      entryPx: number;
      exitPx: number;
      realizedPnl: number;
      exitReason: string;
      score: number;
    }>;
    honesty: string;
    candleCount: number;
    eventCount: number;
  }>(null);

  const snap = useQuery({
    queryKey: ["vigil", "terminal", symbol, granularity],
    queryFn: () =>
      terminalSnapshotFn({
        data: { symbol, granularity, limit: 96 },
      }) as Promise<
        | {
            ok: true;
            candles: Array<{ ts: number; close: number; high: number; low: number; open: number }>;
            quote: { mark: number; last: number } | null;
            orders: Array<{
              id: string;
              side: string;
              lifecycle: string | null;
              price: string | null;
              markPrice: string | null;
              exitPrice: string | null;
              unrealizedPnl: string | null;
              realizedPnl: string | null;
              createdAt: string | Date;
              closedAt: string | Date | null;
              pnlUsd: number | null;
              winLoss: string | null;
              status: string;
              quantity: string;
            }>;
            scoreboard: {
              open: number;
              closed: number;
              wins: number;
              losses: number;
              realizedPnlSum: number;
              unrealizedPnlSum: number;
            };
            fetchedAt: string;
          }
        | { ok: false; code: string; message: string }
      >,
    refetchInterval: 45_000,
  });

  const mem = useQuery({
    queryKey: ["vigil", "memory", symbol],
    queryFn: () =>
      memoryDigestFn({
        data: { ticker: symbol.replace(/USDT$/, ""), movePct: 1.5 },
      }) as Promise<
        | {
            ok: true;
            digest: {
              ticker: string;
              closedSample: number;
              expectancy: number | null;
              winRate: number | null;
              recentLossStreak: number;
              guard: { blockPaper: boolean; reason: string; gate: string };
              blockLines: string[];
              metricLabel: string;
            };
            lessons: Array<{
              id: string;
              outcome: string;
              summary: string;
              realizedPnl: number | null;
              source: string;
              createdAt: string | Date;
              gate: string;
            }>;
            stats: { total: number; byOutcome: Record<string, number>; tickers: number };
          }
        | { ok: false; code: string; message: string }
      >,
    refetchInterval: 60_000,
  });

  const priceSeries = useMemo(() => {
    if (!snap.data || !snap.data.ok) return [];
    return snap.data.candles.map((c) => ({
      ts: c.ts,
      t: new Date(c.ts).toISOString().slice(5, 16).replace("T", " "),
      close: c.close,
      high: c.high,
      low: c.low,
    }));
  }, [snap.data]);

  const markers = useMemo(() => {
    if (!snap.data || !snap.data.ok) return [] as Array<{
      ts: number;
      px: number;
      kind: "entry" | "exit";
      side: string;
      id: string;
    }>;
    const out: Array<{ ts: number; px: number; kind: "entry" | "exit"; side: string; id: string }> =
      [];
    for (const o of snap.data.orders) {
      const entryPx = Number(o.price);
      const entryTs = new Date(o.createdAt).getTime();
      if (entryPx > 0 && entryTs > 0) {
        out.push({ ts: entryTs, px: entryPx, kind: "entry", side: o.side, id: o.id });
      }
      if (o.lifecycle === "closed" && o.exitPrice && o.closedAt) {
        const exitPx = Number(o.exitPrice);
        const exitTs = new Date(o.closedAt).getTime();
        if (exitPx > 0) {
          out.push({ ts: exitTs, px: exitPx, kind: "exit", side: o.side, id: `${o.id}-x` });
        }
      }
    }
    return out;
  }, [snap.data]);

  const btEquity = useMemo(() => {
    if (!backtest?.equityCurve?.length) return [];
    return backtest.equityCurve.map((e) => ({
      t: new Date(e.ts).toISOString().slice(5, 16).replace("T", " "),
      equity: e.equity,
      drawdown: e.drawdown,
    }));
  }, [backtest]);

  async function runBt() {
    setBtBusy(true);
    setBtMsg(null);
    try {
      const res = (await runBacktestFn({
        data: {
          symbol,
          granularity: granularity === "15m" ? "1H" : granularity,
          lookbackBars: 360,
          minAbsMovePct: 1.0,
          minScore: 40,
          holdBars: 8,
          walkForward: true,
          allowlist: [symbol.replace(/USDT$/, "")],
        },
      })) as
        | { ok: true; result: NonNullable<typeof backtest> & { candleCount: number; eventCount: number } }
        | { ok: false; code: string; message: string };
      if (!res.ok) {
        setBtMsg(`${res.code}: ${res.message}`);
        return;
      }
      setBacktest(res.result);
      const m = res.result.metrics;
      const learned =
        "lessonsWritten" in res.result ? Number((res.result as { lessonsWritten?: number }).lessonsWritten ?? 0) : 0;
      setBtMsg(
        `OOS ${m.trades} trades · W${m.wins}/L${m.losses} · PnL ${fmt(m.totalPnl)} · DD ${fmt(m.maxDrawdown)} · memory +${learned}`,
      );
      await qc.invalidateQueries({ queryKey: ["vigil", "memory"] });
    } finally {
      setBtBusy(false);
    }
  }

  const board = snap.data?.ok ? snap.data.scoreboard : null;
  const quote = snap.data?.ok ? snap.data.quote : null;
  const orders = snap.data?.ok ? snap.data.orders : [];

  return (
    <DashboardShell
      title="Trade terminal"
      kicker="Chart · orders · backtest"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void qc.invalidateQueries({ queryKey: ["vigil", "terminal"] })}
          >
            <RefreshCw /> Refresh
          </Button>
          <Button size="sm" disabled={btBusy} onClick={() => void runBt()}>
            <Play /> {btBusy ? "Backtesting…" : "Run backtest"}
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        {SYMBOLS.map((s) => (
          <button
            key={s}
            type="button"
            className={`border px-3 py-1.5 font-medium ${
              symbol === s ? "border-primary bg-primary/15 text-primary" : "border-border"
            }`}
            onClick={() => setSymbol(s)}
          >
            {s}
          </button>
        ))}
        <span className="mx-1 text-muted-foreground">·</span>
        {(["15m", "1H", "4H"] as const).map((g) => (
          <button
            key={g}
            type="button"
            className={`border px-2.5 py-1.5 ${
              granularity === g ? "border-primary bg-primary/10" : "border-border"
            }`}
            onClick={() => setGranularity(g)}
          >
            {g}
          </button>
        ))}
        {quote && (
          <span className="ml-auto font-mono text-sm">
            mark <strong>{quote.mark.toFixed(2)}</strong>
            <span className="ml-2 text-muted-foreground">last {quote.last.toFixed(2)}</span>
          </span>
        )}
      </div>

      {board && (
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <Tile label="Open" value={String(board.open)} />
          <Tile label="Closed W/L" value={`${board.wins}/${board.losses}`} />
          <Tile label="Realized" value={fmt(board.realizedPnlSum)} />
          <Tile label="Unrealized" value={fmt(board.unrealizedPnlSum)} />
        </div>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-5">
        <Panel title={`${symbol} price`} meta={granularity} className="lg:col-span-3">
          <div className="h-[320px] w-full">
            {priceSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} minTickGap={40} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} width={56} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke="var(--primary)"
                    dot={false}
                    strokeWidth={1.75}
                    name="close"
                  />
                  {markers.map((m) => {
                    const nearest = priceSeries.reduce((best, p) =>
                      Math.abs(p.ts - m.ts) < Math.abs(best.ts - m.ts) ? p : best,
                    priceSeries[0]!,
                    );
                    return (
                      <ReferenceDot
                        key={m.id}
                        x={nearest.t}
                        y={m.px}
                        r={5}
                        fill={m.kind === "entry" ? "var(--primary)" : "var(--destructive)"}
                        stroke="transparent"
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">
                {snap.isLoading ? "Loading candles…" : "No candle data."}
              </p>
            )}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Green dots ≈ paper entries · red ≈ exits (Demo). Candles observed from Bitget public API.
          </p>
        </Panel>

        <Panel title="Order blotter" meta={`${orders.length} · ${symbol}`} className="lg:col-span-2">
          <div className="max-h-[340px] overflow-y-auto text-xs">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-card text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2">Side</th>
                  <th>Life</th>
                  <th>Entry</th>
                  <th>Mark/Exit</th>
                  <th>PnL</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-border/70">
                    <td className="py-2 uppercase">{o.side}</td>
                    <td>{o.lifecycle ?? "open"}</td>
                    <td className="font-mono">{o.price ?? "—"}</td>
                    <td className="font-mono">
                      {o.lifecycle === "closed" ? (o.exitPrice ?? "—") : (o.markPrice ?? "—")}
                    </td>
                    <td className="font-mono">{fmt(o.pnlUsd)}</td>
                  </tr>
                ))}
                {!orders.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-muted-foreground">
                      No paper orders for {symbol} yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Backtest (walk-forward)" meta="FENN · rubric · observed candles">
        {btMsg && <p className="mb-3 text-xs text-muted-foreground">{btMsg}</p>}
        {!backtest ? (
          <p className="text-sm text-muted-foreground">
            Run a rigorous walk-forward backtest on Bitget history: catalyst spikes → score gate →
            fixed size → hold/invalidation exits with AH slippage. PnL labeled estimated.
          </p>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="Trades" value={String(backtest.metrics.trades)} />
              <Tile
                label="Win rate"
                value={`${(backtest.metrics.winRate * 100).toFixed(0)}%`}
              />
              <Tile label="Total PnL" value={fmt(backtest.metrics.totalPnl)} />
              <Tile label="Expectancy" value={fmt(backtest.metrics.expectancy)} />
              <Tile
                label="Profit factor"
                value={
                  backtest.metrics.profitFactor != null
                    ? backtest.metrics.profitFactor.toFixed(2)
                    : "—"
                }
              />
              <Tile label="Max DD" value={fmt(backtest.metrics.maxDrawdown)} />
            </div>
            {backtest.walkForward && (
              <p className="mb-3 text-xs text-muted-foreground">
                Train {backtest.walkForward.trainTrades} trades · PnL{" "}
                {fmt(backtest.walkForward.train.totalPnl)} · Test{" "}
                {backtest.walkForward.testTrades} · PnL {fmt(backtest.walkForward.test.totalPnl)} ·
                test WR {(backtest.walkForward.test.winRate * 100).toFixed(0)}% · candles{" "}
                {backtest.candleCount} · events {backtest.eventCount}
              </p>
            )}
            <div className="mb-4 h-[200px] w-full">
              {btEquity.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={btEquity}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="t" tick={{ fontSize: 10 }} minTickGap={36} />
                    <YAxis tick={{ fontSize: 10 }} width={48} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="var(--primary)"
                      fill="color-mix(in oklch, var(--primary) 20%, transparent)"
                      name="equity"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No equity points (zero fills).</p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2">Side</th>
                    <th>Score</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Reason</th>
                    <th>PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {backtest.trades.map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="py-2 uppercase">{t.side}</td>
                      <td>{t.score}</td>
                      <td className="font-mono">{t.entryPx.toFixed(3)}</td>
                      <td className="font-mono">{t.exitPx.toFixed(3)}</td>
                      <td>{t.exitReason}</td>
                      <td className="font-mono">{fmt(t.realizedPnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">{backtest.honesty}</p>
          </>
        )}
      </Panel>

      <Panel
        title="Agent memory"
        meta={
          mem.data?.ok
            ? `${mem.data.stats.total} lessons · ${mem.data.digest.guard.gate}`
            : "loading"
        }
        className="mt-5"
      >
        {mem.data?.ok ? (
          <>
            <div className="mb-3 grid gap-3 sm:grid-cols-4">
              <Tile label="Sample" value={String(mem.data.digest.closedSample)} />
              <Tile
                label="Expectancy"
                value={
                  mem.data.digest.expectancy != null
                    ? fmt(mem.data.digest.expectancy)
                    : "—"
                }
              />
              <Tile
                label="Win rate"
                value={
                  mem.data.digest.winRate != null
                    ? `${(mem.data.digest.winRate * 100).toFixed(0)}%`
                    : "—"
                }
              />
              <Tile
                label="Guard"
                value={mem.data.digest.guard.blockPaper ? "BLOCK" : "PASS"}
              />
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{mem.data.digest.guard.reason}</p>
            <ul className="mb-4 space-y-1 font-mono text-[11px] text-muted-foreground">
              {mem.data.digest.blockLines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <div className="max-h-[220px] overflow-y-auto text-xs">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-card text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2">Outcome</th>
                    <th>Source</th>
                    <th>PnL</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {mem.data.lessons.slice(0, 20).map((l) => (
                    <tr key={l.id} className="border-t border-border/70">
                      <td className="py-2">{l.outcome}</td>
                      <td>{l.source}</td>
                      <td className="font-mono">{fmt(l.realizedPnl)}</td>
                      <td className="max-w-[320px] truncate">{l.summary}</td>
                    </tr>
                  ))}
                  {!mem.data.lessons.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-muted-foreground">
                        No lessons yet — run a backtest or close a Demo trade to teach memory.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sign in required for tenant memory.</p>
        )}
      </Panel>
    </DashboardShell>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
