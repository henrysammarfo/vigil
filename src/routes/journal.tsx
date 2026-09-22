import { createFileRoute } from "@tanstack/react-router";
import { Check, CircleSlash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/vigil/page-shell";
import { publicJournalFn } from "@/api/dashboard";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "VIGIL Journal — Explainable decisions" },
      { name: "description", content: "A public look at VIGIL's append-only decision record." },
    ],
  }),
  component: Journal,
});

function Journal() {
  const q = useQuery({
    queryKey: ["vigil", "public-journal"],
    queryFn: () => publicJournalFn(),
  });
  const rows = q.data?.ok ? q.data.rows : [];

  return (
    <PageShell
      eyebrow="Journal / 02"
      title="The action."
      accent="And the why."
      intro="An append-only record makes every decision inspectable. Metrics are explicitly labeled observed, estimated, or simulated."
    >
      <section className="mx-auto max-w-[1440px] px-5 pb-28 md:px-[8vw]">
        <div className="border-y border-border">
          {rows.map((r, i) => (
            <article
              key={`${String(r.contentHash)}-${i}`}
              className="grid items-center gap-5 border-b border-border py-7 last:border-0 md:grid-cols-[80px_1fr_150px_110px]"
            >
              <div className="flex h-12 w-12 items-center justify-center bg-foreground font-bold text-background">
                {String(r.ticker ?? "??").slice(0, 2)}
              </div>
              <div>
                <h2 className="font-bold uppercase">{String(r.ticker)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{String(r.headline)}</p>
              </div>
              <span
                className={
                  r.action === "PAPER_BUY" || r.action === "PAPER_SELL"
                    ? "text-primary"
                    : "text-muted-foreground"
                }
              >
                {r.action === "NO_TRADE" ? (
                  <CircleSlash2 className="mr-2 inline h-4 w-4" />
                ) : (
                  <Check className="mr-2 inline h-4 w-4" />
                )}
                {String(r.action)}
              </span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {String(r.metricLabel)}
              </span>
            </article>
          ))}
          {!rows.length && (
            <p className="py-12 text-sm text-muted-foreground">
              No public journal entries yet. Set VIGIL_DEFAULT_TENANT_SLUG to a tenant that has
              sealed why-cards.
            </p>
          )}
        </div>
      </section>
    </PageShell>
  );
}
