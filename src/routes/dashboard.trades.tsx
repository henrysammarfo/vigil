import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Download, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { DashboardShell, Panel } from "@/components/vigil/dashboard-shell";
import { useDashboard } from "@/components/vigil/dashboard-data";
import { Button } from "@/components/ui/button";
import { closePaperOrderFn, exportPaperLogFn, markPaperOrdersFn } from "@/api/dashboard";

export const Route = createFileRoute("/dashboard/trades")({
  head: () => ({
    meta: [
      { title: "Paper Trades — VIGIL" },
      { name: "description", content: "VIGIL Agent Hub paper orders with mark-to-exit PnL." },
    ],
  }),
  component: Trades,
});

type EntryAnalysisView = {
  thesis?: string;
  bullCase?: string[];
  bearCase?: string[];
  invalidation?: string[];
  biasChecks?: string[];
  sessionRisk?: string;
  sizeRule?: string;
};

function fmtPnl(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(4)}`;
}

function Trades() {
  const q = useDashboard();
  const qc = useQueryClient();
  const orders = q.data?.ok ? q.data.orders : [];
  const scoreboard = q.data?.ok ? q.data.scoreboard : null;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function refreshMarks() {
    setMsg(null);
    const res = await markPaperOrdersFn();
    if (!res.ok) {
      setMsg(`${res.code}: ${res.message}`);
      return;
    }
    setMsg(`Marked ${res.marked} open · wins ${res.scoreboard.wins} / losses ${res.scoreboard.losses}`);
    await qc.invalidateQueries({ queryKey: ["vigil", "dashboard"] });
  }

  async function closeOrder(orderId: string) {
    setBusyId(orderId);
    setMsg(null);
    try {
      const res = (await closePaperOrderFn({ data: { orderId } })) as
        | {
            ok: true;
            order: {
              symbol: string;
              pnlUsd: number | null;
            };
            scoreboard: { wins: number; losses: number };
          }
        | { ok: false; code: string; message: string };
      if (!res.ok) {
        setMsg(`${res.code}: ${res.message}`);
        return;
      }
      const pnl = res.order.pnlUsd;
      setMsg(
        `Closed ${res.order.symbol} · realized ${fmtPnl(pnl)} · scoreboard W${res.scoreboard.wins}/L${res.scoreboard.losses}`,
      );
      await qc.invalidateQueries({ queryKey: ["vigil", "dashboard"] });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell
      title="Paper trades"
      kicker="Agent Hub · paper · mark-to-exit"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void refreshMarks()}>
            <RefreshCw /> Mark open
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await exportPaperLogFn();
              if (!res.ok) {
                setMsg(`${res.code}: ${res.message}`);
                return;
              }
              const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `vigil-paper-log-${res.exportedAt}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download /> Export
          </Button>
        </div>
      }
    >
      <div className="mb-5 flex items-center gap-3 border border-primary-edge bg-primary/10 p-4 text-xs">
        <ShieldCheck className="text-primary" /> All orders shown are Bitget Demo / paper. Mark and
        exit use Demo quotes. Not financial advice.
      </div>

      {scoreboard && (
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <ScoreTile label="Open" value={String(scoreboard.open)} />
          <ScoreTile label="Closed" value={String(scoreboard.closed)} />
          <ScoreTile
            label="Wins / Losses"
            value={`${scoreboard.wins} / ${scoreboard.losses}`}
          />
          <ScoreTile
            label="Realized PnL"
            value={fmtPnl(scoreboard.realizedPnlSum)}
            hint={`unrealized ${fmtPnl(scoreboard.unrealizedPnlSum)}`}
          />
        </div>
      )}

      {msg && <p className="mb-4 text-xs text-muted-foreground">{msg}</p>}

      <Panel title="Order ledger" meta={`${orders.length} orders`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="pb-4">Time</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Entry</th>
                <th>Mark / Exit</th>
                <th>PnL</th>
                <th>Life</th>
                <th>Why</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const analysis = (o.entryAnalysis ?? null) as EntryAnalysisView | null;
                const pnl =
                  "pnlUsd" in o && typeof o.pnlUsd === "number"
                    ? o.pnlUsd
                    : o.lifecycle === "closed"
                      ? Number(o.realizedPnl)
                      : Number(o.unrealizedPnl);
                const life = o.lifecycle || "open";
                return (
                  <Fragment key={o.id}>
                    <tr className="border-t border-border">
                      <td className="py-4 whitespace-nowrap text-xs">
                        {new Date(o.createdAt).toISOString().slice(0, 19)}Z
                      </td>
                      <td className="font-bold">{o.symbol}</td>
                      <td className="uppercase">{o.side}</td>
                      <td>{o.quantity}</td>
                      <td className="font-mono text-xs">{o.price ?? "—"}</td>
                      <td className="font-mono text-xs">
                        {life === "closed" ? (o.exitPrice ?? "—") : (o.markPrice ?? "—")}
                      </td>
                      <td
                        className={`font-mono text-xs ${
                          Number.isFinite(pnl) && pnl > 0
                            ? "text-primary"
                            : Number.isFinite(pnl) && pnl < 0
                              ? "text-destructive"
                              : ""
                        }`}
                      >
                        {fmtPnl(Number.isFinite(pnl) ? pnl : null)}
                        {"winLoss" in o && o.winLoss ? (
                          <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                            {String(o.winLoss)}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-[10px] uppercase">{life}</td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                        >
                          {analysis?.thesis ? "Analysis" : "—"}
                        </Button>
                      </td>
                      <td>
                        {life === "open" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-[10px]"
                            disabled={busyId === o.id}
                            onClick={() => void closeOrder(o.id)}
                          >
                            <XCircle className="h-3 w-3" />
                            {busyId === o.id ? "Closing…" : "Exit"}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">closed</span>
                        )}
                      </td>
                    </tr>
                    {expanded === o.id && analysis && (
                      <tr className="border-t border-border/50 bg-muted/20">
                        <td colSpan={10} className="px-3 py-4 text-xs leading-relaxed">
                          <p className="mb-2 font-medium">{analysis.thesis}</p>
                          <div className="grid gap-3 md:grid-cols-2">
                            <ListBlock title="Bull" items={analysis.bullCase ?? []} />
                            <ListBlock title="Bear" items={analysis.bearCase ?? []} />
                            <ListBlock title="Invalidation" items={analysis.invalidation ?? []} />
                            <ListBlock title="Bias checks" items={analysis.biasChecks ?? []} />
                          </div>
                          <p className="mt-3 text-muted-foreground">
                            Session: {analysis.sessionRisk ?? "—"} · Size:{" "}
                            {analysis.sizeRule ?? "fixed paper"}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!orders.length && (
                <tr>
                  <td className="py-8 text-muted-foreground" colSpan={10}>
                    No paper orders yet. Configure Bitget Demo keys and run the agent.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </DashboardShell>
  );
}

function ScoreTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-border bg-card/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase text-muted-foreground">{title}</p>
      <ul className="list-disc space-y-1 pl-4">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
