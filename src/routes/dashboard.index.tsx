import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Radio, ShieldCheck, Sparkles } from "lucide-react";
import { DashboardShell, Panel } from "@/components/vigil/dashboard-shell";
import { Score, Trend, useDashboard } from "@/components/vigil/dashboard-data";
import { Button } from "@/components/ui/button";
import { runAgentFn } from "@/api/dashboard";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Overview — VIGIL" },
      { name: "description", content: "VIGIL closed-market monitoring overview." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const q = useDashboard();
  const qc = useQueryClient();
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const data = q.data?.ok ? q.data : null;
  const signals = data?.signals ?? [];
  const orders = data?.orders ?? [];
  const top = signals[0];
  const window = data?.window;

  return (
    <DashboardShell
      title="Vigil overview"
      kicker={
        window
          ? `${window.state} · ${new Date(window.nowUtc).toISOString().slice(11, 16)} UTC`
          : "Loading…"
      }
      actions={
        <Button
          variant={window && !window.allowed ? "outline" : "signal"}
          size="sm"
          disabled={!window?.allowed || Boolean(runMsg?.startsWith("Running"))}
          title={
            window && !window.allowed
              ? `${window.reason} — Run agent only after hours / weekend`
              : "Run closed-window agent cycle"
          }
          onClick={async () => {
            if (!window?.allowed) {
              setRunMsg(`Skipped: ${window?.reason ?? "closed window not active"}`);
              return;
            }
            setRunMsg("Running…");
            const res = await runAgentFn();
            if (res.ok) {
              setRunMsg(`Run ${res.result.status}: ${res.result.runId}`);
              await qc.invalidateQueries({ queryKey: ["vigil"] });
            } else {
              setRunMsg(`${res.code}: ${res.message}`);
            }
          }}
        >
          {window && !window.allowed ? "Standing down" : "Run agent"}
        </Button>
      }
    >
      {runMsg && <p className="mb-4 text-xs text-muted-foreground">{runMsg}</p>}
      {!data && q.isLoading && (
        <p className="text-sm text-muted-foreground">Loading live tenant data…</p>
      )}
      {q.data && !q.data.ok && (
        <p className="text-sm text-destructive">
          {q.data.code}: {q.data.message}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        <Stat
          icon={Clock3}
          value={window?.allowed ? "ACTIVE" : "WAIT"}
          label="Closed-window gate"
        />
        <Stat icon={Radio} value={String(signals.length).padStart(2, "0")} label="Signals stored" />
        <Stat
          icon={ShieldCheck}
          value={String(orders.length).padStart(2, "0")}
          label="Paper decisions"
        />
        <Stat icon={Sparkles} value={String(top?.score ?? 0)} label="Top signal score" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
        <Panel title="Event watch" meta="Observed / live">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead className="text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="pb-4">rToken</th>
                  <th>Move</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Label</th>
                </tr>
              </thead>
              <tbody>
                {signals.slice(0, 5).map((s) => (
                  <tr key={s.id} className="border-t border-border text-sm">
                    <td className="py-5 font-bold">{s.ticker}</td>
                    <td>
                      <Trend value={s.movePct} />
                    </td>
                    <td>
                      <Score value={s.score} />
                    </td>
                    <td>{s.state}</td>
                    <td className="text-[10px] uppercase text-muted-foreground">{s.metricLabel}</td>
                  </tr>
                ))}
                {!signals.length && (
                  <tr>
                    <td className="py-8 text-sm text-muted-foreground" colSpan={5}>
                      No live signals yet. Click Run agent during a closed window with news + LLM +
                      Bitget Demo keys configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Gate" meta={window?.state ?? "—"}>
          <p className="text-sm leading-6 text-muted-foreground">
            {window?.reason ?? "Awaiting window evaluation."}
          </p>
          <p className="mt-4 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Paper only · not financial advice · not unhackable
          </p>
        </Panel>
      </div>
    </DashboardShell>
  );
}

function Stat({ icon: I, value, label }: { icon: typeof Clock3; value: string; label: string }) {
  return (
    <div className="border border-border bg-background p-5">
      <I className="h-4 w-4 text-primary" />
      <p className="mt-8 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
    </div>
  );
}
