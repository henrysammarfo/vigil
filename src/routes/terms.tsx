import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/vigil/page-shell";
import { pageMeta } from "@/lib/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: pageMeta({
      title: "Terms & Conditions — VIGIL",
      description:
        "Terms of use for VIGIL paper trading: Demo-only, no financial advice, your workspace, your keys.",
      path: "/terms",
    }),
  }),
  component: Terms,
});

function Terms() {
  return (
    <PageShell
      eyebrow="Legal / Terms"
      title="Terms &"
      accent="conditions."
      intro="By using VIGIL you agree to these terms. Paper simulation only. Not financial advice. Not an offer to trade live capital."
    >
      <article className="mx-auto max-w-[760px] space-y-8 px-5 pb-28 text-sm leading-7 text-foreground md:px-0">
        <p className="text-muted-foreground">Last updated: 23 September 2026</p>
        <section>
          <h2 className="text-lg font-bold uppercase">1. Product</h2>
          <p className="mt-2 text-muted-foreground">
            VIGIL is a closed-market event-driven research and Demo paper-trading interface for
            tokenized US stock symbols on Bitget Demo. It is built for education, hackathon
            evaluation, and personal experimentation.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">2. Paper only</h2>
          <p className="mt-2 text-muted-foreground">
            All execution paths are locked to paper / Demo mode. You must not configure or expect
            live trading through VIGIL for S2. Any performance numbers are labeled observed,
            estimated, or simulated and can be wrong.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">3. No financial advice</h2>
          <p className="mt-2 text-muted-foreground">
            Nothing on the site is investment, trading, tax, or legal advice. You are solely
            responsible for decisions made with or without VIGIL output.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">4. Your workspace</h2>
          <p className="mt-2 text-muted-foreground">
            Registration creates a private tenant. You are responsible for your allowlist, Demo API
            keys, and activity. Do not share credentials. You must only use Bitget Demo keys you are
            authorized to use.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">5. Acceptable use</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>No abuse, scraping that harms service, or spam via the contact form.</li>
            <li>No attempts to bypass paper locks or extract other tenants’ data.</li>
            <li>No unlawful content in messages or uploaded material.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">6. Availability</h2>
          <p className="mt-2 text-muted-foreground">
            The service is provided “as is” without warranties. Features, uptime, and third-party
            APIs (Bitget, LLM, news) may change or fail.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">7. Limitation of liability</h2>
          <p className="mt-2 text-muted-foreground">
            To the fullest extent permitted by law, operators are not liable for losses from use of
            VIGIL, Demo trading outcomes, or reliance on agent rationale.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">8. Changes</h2>
          <p className="mt-2 text-muted-foreground">
            We may update these terms. Continued use after posting changes constitutes acceptance.
            See also the{" "}
            <a className="underline hover:text-primary" href="/privacy">
              Privacy Policy
            </a>
            .
          </p>
        </section>
      </article>
    </PageShell>
  );
}
