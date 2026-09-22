import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  CircleCheck,
  Newspaper,
  ShieldCheck,
  Timer,
  Zap,
} from "lucide-react";
import { PageShell } from "@/components/vigil/page-shell";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How VIGIL Works — Closed-market pipeline" },
      { name: "description", content: "Explore VIGIL's event-to-paper-order decision pipeline." },
      { property: "og:title", content: "How VIGIL Works" },
      {
        property: "og:description",
        content: "Six gates between a headline and an explainable paper order.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: How,
});
const stages = [
  ["01", Newspaper, "Event intake", "A macro or company headline enters the watch queue."],
  ["02", Timer, "Window gate", "VIGIL confirms US regular trading hours are closed."],
  [
    "03",
    Zap,
    "FENN allowlist",
    "Allowlist starts empty. Headline alone is a NO why-card — never a fill.",
  ],
  [
    "04",
    BrainCircuit,
    "Signal + policy",
    "Named allowlisted rToken must actually move; LLM may still refuse.",
  ],
  [
    "05",
    ShieldCheck,
    "Paper order",
    "Agent Hub Demo receives one fixed-size paper side — never both.",
  ],
  ["06", CircleCheck, "Why-log", "Nos and yeses seal append-only. The journal is the product."],
] as const;
function How() {
  return (
    <PageShell
      eyebrow="System / 01"
      title="One event."
      accent="Six gates."
      intro="Nothing reaches the paper account by accident. Every decision passes a visible, deterministic chain designed for closed-market conditions."
    >
      <section className="bg-ink py-20 text-ink-foreground">
        <div className="mx-auto max-w-5xl px-5">
          {stages.map(([n, I, t, d], i) => (
            <div
              key={n}
              className="grid gap-5 border-t border-ink-border py-8 md:grid-cols-[70px_70px_1fr_1fr]"
            >
              <span className="text-xs text-ink-muted">{n}</span>
              <I className="text-primary" />
              <h2 className="text-xl font-bold uppercase">{t}</h2>
              <p className="text-sm leading-6 text-ink-muted">{d}</p>
              {i < stages.length - 1 && <ArrowDown className="hidden text-ink-muted md:block" />}
            </div>
          ))}
          <Button variant="signal" size="signal" className="mt-10" asChild>
            <Link to="/dashboard/replay">
              Run a replay <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
