import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/vigil/page-shell";
import { pageMeta } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: pageMeta({
      title: "Privacy Policy — VIGIL",
      description:
        "How VIGIL handles account data, session cookies, Bitget Demo credentials, and optional analytics.",
      path: "/privacy",
    }),
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <PageShell
      eyebrow="Legal / Privacy"
      title="Privacy"
      accent="policy."
      intro="VIGIL is a paper-trading research product. This policy explains what we store, why, and how you control it. Paper only · not financial advice."
    >
      <article className="mx-auto max-w-[760px] space-y-8 px-5 pb-28 text-sm leading-7 text-foreground md:px-0">
        <p className="text-muted-foreground">Last updated: 23 September 2026</p>
        <section>
          <h2 className="text-lg font-bold uppercase">Who we are</h2>
          <p className="mt-2 text-muted-foreground">
            VIGIL is operated by Henry Sam Marfo for the Bitget AI Base Camp S2 hackathon and related
            demos. Contact: via the{" "}
            <a className="underline hover:text-primary" href="/contact">
              Contact
            </a>{" "}
            form or{" "}
            <a className="underline hover:text-primary" href="https://x.com/henrysammarfo">
              @henrysammarfo
            </a>
            .
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">What we collect</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Account:</strong> email, password hash, display
              name, and your private tenant/workspace.
            </li>
            <li>
              <strong className="text-foreground">Session cookie:</strong> httpOnly{" "}
              <code className="text-foreground">vigil_session</code> to keep you signed in (necessary
              for the product).
            </li>
            <li>
              <strong className="text-foreground">Workspace data:</strong> allowlist, settings,
              paper orders, why-cards, agent memory lessons — scoped to your tenant.
            </li>
            <li>
              <strong className="text-foreground">Bitget Demo credentials:</strong> if you connect
              them in Settings, they are encrypted at rest and never returned to the browser after
              save.
            </li>
            <li>
              <strong className="text-foreground">Contact messages:</strong> name, email, message
              you submit.
            </li>
            <li>
              <strong className="text-foreground">Optional analytics:</strong> only if you accept
              cookies and a privacy-friendly analytics domain is configured (e.g. Plausible). No ads
              tracking by default.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">What we do not do</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>We do not sell personal data.</li>
            <li>We do not place live exchange orders for S2 — paper / Demo only.</li>
            <li>We do not put API secrets in frontend bundles.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">Cookies</h2>
          <p className="mt-2 text-muted-foreground">
            Necessary session cookies run without optional consent. Optional analytics cookies/scripts
            load only after you Accept on the cookie banner. You can Reject optional and still use
            the product.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">Retention & deletion</h2>
          <p className="mt-2 text-muted-foreground">
            Workspace data persists while your account exists. Contact us to request deletion of
            account and associated tenant data. Encrypted Demo credentials can be cleared anytime in
            Settings → Disconnect.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">Security</h2>
          <p className="mt-2 text-muted-foreground">
            Passwords are hashed (bcrypt). Tenant secrets use AES-GCM keyed from server{" "}
            <code className="text-foreground">SESSION_SECRET</code>. Transport should be HTTPS in
            production (HSTS enforced on our Vercel deploy).
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold uppercase">Third parties</h2>
          <p className="mt-2 text-muted-foreground">
            Bitget Demo APIs (your keys), LLM/news providers used by the server agent, and hosting
            (Vercel / database). Each is used to run the paper pipeline you configure.
          </p>
        </section>
      </article>
    </PageShell>
  );
}
