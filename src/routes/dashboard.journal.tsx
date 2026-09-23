import { createFileRoute } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { useState } from "react";
import { DashboardShell, Panel } from "@/components/vigil/dashboard-shell";
import { useDashboard } from "@/components/vigil/dashboard-data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/journal")({
  head: () => ({
    meta: [
      { title: "Why-log — VIGIL" },
      { name: "description", content: "Append-only decision evidence for VIGIL." },
    ],
  }),
  component: Why,
});

function asLines(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}

function Why() {
  const q = useDashboard();
  const cards = q.data?.ok ? q.data.whyCards : [];
  const scoreboard = q.data?.ok ? q.data.scoreboard : null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = cards.find((c) => c.id === selectedId) ?? cards[0] ?? null;
  const body = (selected?.body ?? {}) as Record<string, unknown>;
  const analysis =
    body.entryAnalysis && typeof body.entryAnalysis === "object"
      ? (body.entryAnalysis as Record<string, unknown>)
      : null;

  return (
    <DashboardShell
      title="Why-log"
      kicker={
        scoreboard
          ? `Append-only journal · $100 book $${scoreboard.bankroll.equityUsd.toFixed(2)}`
          : "Append-only decision journal"
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          disabled={!selected}
          onClick={async () => {
            if (!selected) return;
            await navigator.clipboard.writeText(selected.contentHash);
          }}
        >
          <Copy /> Copy hash
        </Button>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[.45fr_1fr]">
        <Panel title="Entries" meta={`${cards.length} sealed`}>
          <div className="space-y-2">
            {cards.map((c) => {
              const b = c.body as Record<string, unknown>;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full border-l-4 p-4 text-left ${
                    selected?.id === c.id
                      ? "border-primary bg-surface"
                      : "border-border bg-background"
                  }`}
                >
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {new Date(c.sealedAt).toISOString()} · #{c.seq}
                  </p>
                  <p className="mt-2 font-bold">
                    {String(b.ticker ?? "—")} / {String(b.action ?? "—")}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Confidence {String(b.confidence ?? "—")} · hash {c.contentHash.slice(0, 10)}…
                  </p>
                </button>
              );
            })}
            {!cards.length && (
              <p className="text-sm text-muted-foreground">No sealed why-cards yet.</p>
            )}
          </div>
        </Panel>
        <Panel
          title={selected ? `Why-card #${selected.seq}` : "Why-card"}
          meta={selected?.contentHash.slice(0, 16)}
        >
          {selected ? (
            <div className="space-y-5 text-sm leading-7">
              <p>
                <span className="font-bold uppercase">Headline:</span> {String(body.headline ?? "")}
              </p>
              <p>
                <span className="font-bold uppercase">Rationale:</span>{" "}
                {String(body.rationale ?? "")}
              </p>
              {analysis && (
                <div className="space-y-4 border-t border-border pt-4">
                  <p>
                    <span className="font-bold uppercase">Thesis:</span>{" "}
                    {String(analysis.thesis ?? "—")}
                  </p>
                  <ListBlock title="Bull" items={asLines(analysis.bullCase)} />
                  <ListBlock title="Bear" items={asLines(analysis.bearCase)} />
                  <ListBlock title="Invalidation" items={asLines(analysis.invalidation)} />
                  <ListBlock title="Bias checks" items={asLines(analysis.biasChecks)} />
                  {analysis.sessionRisk ? (
                    <p>
                      <span className="font-bold uppercase">Session:</span>{" "}
                      {String(analysis.sessionRisk)}
                    </p>
                  ) : null}
                  {analysis.sizeRule ? (
                    <p>
                      <span className="font-bold uppercase">Size:</span> {String(analysis.sizeRule)}
                    </p>
                  ) : null}
                </div>
              )}
              <p>
                <span className="font-bold uppercase">LLM:</span> {String(body.llmProvider)} /{" "}
                {String(body.llmModel)}
              </p>
              <p>
                <span className="font-bold uppercase">Gates:</span>{" "}
                {Array.isArray(body.gates) ? body.gates.join(" → ") : "—"}
              </p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                prev {selected.prevHash.slice(0, 16)}… · sealed append-only · paper = live $100 book
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">Select a sealed entry.</p>
          )}
        </Panel>
      </div>
    </DashboardShell>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="font-bold uppercase">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
        {items.map((line) => (
          <li key={`${title}-${line.slice(0, 48)}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
