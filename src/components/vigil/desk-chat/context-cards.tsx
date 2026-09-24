import { useEffect, useState } from "react";
import type { DeskContextChunk } from "./types";

/** Retrieved workspace context chips (ContextCards pattern). */
export function DeskContextCards({
  chunks,
  header = "Workspace context",
}: {
  chunks: DeskContextChunk[];
  header?: string;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 400);
    return () => window.clearTimeout(t);
  }, []);

  if (!chunks.length) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="desk-fade-in flex items-center gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-foreground">
          {header}
        </span>
        <span className="inline-flex h-5 items-center border border-border bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
          {chunks.length}
        </span>
      </div>
      {chunks.map((chunk, i) => (
        <div
          key={chunk.title}
          className="overflow-hidden border border-border bg-background desk-fade-up"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="truncate text-[13px] font-medium text-foreground">{chunk.title}</span>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{chunk.badge}</span>
          </div>
          <p className="px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {chunk.body}
          </p>
          <div className="px-3 pb-3">
            <span
              className="inline-flex h-6 items-center gap-1.5 border border-border bg-muted/50 px-2 text-[11px] font-medium text-muted-foreground transition-all"
              style={{
                opacity: shown ? 1 : 0,
                transform: shown ? "scale(1)" : "scale(0.95)",
                transitionDelay: `${i * 60}ms`,
              }}
            >
              {chunk.source}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Actionable recommendation strip (RecommendationCard pattern). */
export function DeskQuickActions({
  onPick,
  remaining,
}: {
  onPick: (prompt: string) => void;
  remaining: number;
}) {
  const items = [
    {
      key: "growth",
      label: "Growth book",
      body: "Summarize $100→$5k equity and next closed-window size.",
      prompt: "Summarize my $100→$5000 growth book and what to do next after hours.",
      signal: remaining > 0 ? 3 : 0,
    },
    {
      key: "allow",
      label: "Allowlist",
      body: "Confirm FENN allowlist and refuse-by-default posture.",
      prompt: "What is on my allowlist and how does FENN refuse-by-default work for me?",
      signal: 2,
    },
    {
      key: "agent",
      label: "Run agent",
      body: "When the window opens, use Overview — chat cannot place trades.",
      prompt: "When can I run the agent and what Settings should I verify first?",
      signal: 2,
    },
  ];

  return (
    <div className="w-full overflow-hidden border border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[13px] font-medium text-foreground">Want a focused desk answer?</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Each send burns one of your {remaining} remaining messages today.
        </p>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={remaining <= 0}
            onClick={() => onPick(item.prompt)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
          >
            <Meter signal={item.signal} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-bold uppercase tracking-[0.1em] text-foreground">
                {item.label}
              </span>
              <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{item.body}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Meter({ signal }: { signal: number }) {
  return (
    <span className="mt-1 flex items-end gap-0.5" aria-hidden>
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="w-1 rounded-full"
          style={{
            height: 10,
            background: bar < signal ? "var(--primary)" : "var(--border)",
          }}
        />
      ))}
    </span>
  );
}
