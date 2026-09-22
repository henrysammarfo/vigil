import { createFileRoute } from "@tanstack/react-router";
import { Filter, Search } from "lucide-react";
import { DashboardShell, Panel } from "@/components/vigil/dashboard-shell";
import { Score, Trend, useDashboard } from "@/components/vigil/dashboard-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/dashboard/signals")({
  head: () => ({
    meta: [
      { title: "Signals — VIGIL" },
      { name: "description", content: "Closed-market rToken signal queue." },
    ],
  }),
  component: Signals,
});

function Signals() {
  const q = useDashboard();
  const [term, setTerm] = useState("");
  const signals = useMemo(() => (q.data?.ok ? q.data.signals : []), [q.data]);
  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return signals;
    return signals.filter(
      (s) =>
        s.ticker.toLowerCase().includes(t) ||
        s.state.toLowerCase().includes(t) ||
        String(s.details).toLowerCase().includes(t),
    );
  }, [signals, term]);

  return (
    <DashboardShell
      title="Signal queue"
      kicker={`${signals.length} events · live tenant`}
      actions={
        <Button variant="outline" size="sm">
          <Filter /> Filter
        </Button>
      }
    >
      <Panel title="Closed-market events" meta="Observed movement">
        <div className="relative mb-5">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search event or rToken"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          {filtered.map((s) => (
            <article
              key={s.id}
              className="grid items-center gap-4 border border-border p-5 md:grid-cols-[70px_1fr_100px_160px_90px]"
            >
              <div className="font-bold">{s.ticker}</div>
              <div className="text-sm text-muted-foreground">
                {(s.details as { reason?: string })?.reason ?? s.state} · {s.metricLabel}
              </div>
              <Trend value={s.movePct} />
              <Score value={s.score} />
              <span className="text-[10px] uppercase tracking-[0.1em]">{s.state}</span>
            </article>
          ))}
          {!filtered.length && (
            <p className="py-10 text-sm text-muted-foreground">
              No signals match. Run the agent to ingest live news.
            </p>
          )}
        </div>
      </Panel>
    </DashboardShell>
  );
}
