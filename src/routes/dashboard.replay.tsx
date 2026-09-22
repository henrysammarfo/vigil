import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell, Panel } from "@/components/vigil/dashboard-shell";
import { useDashboard } from "@/components/vigil/dashboard-data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/replay")({
  head: () => ({
    meta: [
      { title: "Replay — VIGIL" },
      { name: "description", content: "Replay VIGIL event decisions gate by gate." },
    ],
  }),
  component: Replay,
});

function Replay() {
  const q = useDashboard();
  const card = q.data?.ok ? q.data.whyCards[0] : null;
  const body = (card?.body ?? {}) as { gates?: string[]; ticker?: string; action?: string };
  const steps = useMemo(() => {
    const raw =
      body.gates?.length
        ? body.gates
        : [
            "event-received",
            "closed-window-verified",
            "signal-movement-checked",
            "policy-scored",
            "paper-order-accepted",
            "why-card-sealed",
          ];
    return raw.map(humanGate);
  }, [body.gates]);

  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (at >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setAt((v) => v + 1), 900);
    return () => clearTimeout(t);
  }, [playing, at, steps.length]);

  return (
    <DashboardShell
      title="Decision replay"
      kicker={card ? `${String(body.ticker)} · ${String(body.action)}` : "Awaiting sealed why-card"}
    >
      <Panel title="Timeline" meta={card ? `seq #${card.seq}` : "no live card"}>
        <div className="py-8">
          <div className="relative mx-auto flex max-w-5xl justify-between gap-2 before:absolute before:left-4 before:right-4 before:top-4 before:h-px before:bg-border">
            {steps.map((s, i) => (
              <button
                key={`${s}-${i}`}
                type="button"
                onClick={() => setAt(i)}
                className="relative z-10 flex w-28 flex-col items-center gap-3"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center text-xs font-bold ${
                    i <= at
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="text-center text-[10px] uppercase tracking-[0.06em] leading-snug">
                  {s}
                </span>
              </button>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-xl text-center text-sm text-muted-foreground">
            {steps[at] ?? "—"}
            {playing ? " · playing" : ""}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setPlaying(false);
                setAt(0);
              }}
            >
              Reset
            </Button>
            <Button
              variant="signal"
              onClick={() => {
                if (at >= steps.length - 1) setAt(0);
                setPlaying(true);
              }}
            >
              Play
            </Button>
          </div>
        </div>
      </Panel>
    </DashboardShell>
  );
}

function humanGate(g: string) {
  return g
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
