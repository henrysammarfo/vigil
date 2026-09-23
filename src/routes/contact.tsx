import { createFileRoute, Link } from "@tanstack/react-router";
import { Github, Send } from "lucide-react";
import { PageShell } from "@/components/vigil/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { contactFn } from "@/api/dashboard";
import { pageMeta } from "@/lib/site";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: pageMeta({
      title: "Contact VIGIL — Henry Sam Marfo",
      description: "Contact the creator of VIGIL about the closed-market paper system.",
      path: "/contact",
    }),
  }),
  component: Contact,
});

function Contact() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validate(fd: FormData): boolean {
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const message = String(fd.get("message") ?? "").trim();
    const next: Record<string, string> = {};
    if (name.length < 2) next["name"] = "Name must be at least 2 characters";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next["email"] = "Enter a valid email";
    if (message.length < 10) next["message"] = "Message must be at least 10 characters";
    if (message.length > 5000) next["message"] = "Message is too long";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <PageShell
      eyebrow="Contact / 04"
      title="Start a"
      accent="signal."
      intro="Questions about the system, the build, or the closed-market thesis? Send a note or inspect the project directly."
    >
      <section className="mx-auto grid max-w-[1100px] gap-16 px-5 pb-28 md:grid-cols-[0.7fr_1.3fr]">
        <div>
          <a
            className="flex items-center gap-3 border-t border-border py-5 font-bold uppercase hover:text-primary"
            href="https://x.com/henrysammarfo"
            rel="noopener noreferrer"
            target="_blank"
          >
            X · @henrysammarfo
          </a>
          <a
            className="flex items-center gap-3 border-y border-border py-5 font-bold uppercase hover:text-primary"
            href="https://github.com/henrysammarfo/vigil"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Github aria-hidden="true" /> GitHub
          </a>
          <p className="mt-6 text-xs leading-5 text-muted-foreground">
            Prefer reading first?{" "}
            <Link to="/privacy" className="underline hover:text-primary">
              Privacy
            </Link>{" "}
            ·{" "}
            <Link to="/terms" className="underline hover:text-primary">
              Terms
            </Link>
          </p>
        </div>
        {sent ? (
          <div className="border-l-4 border-primary bg-surface p-8">
            <h2 className="text-2xl font-bold uppercase">Signal received.</h2>
            <p className="mt-3 text-muted-foreground">
              Your message was stored securely in the VIGIL database.
            </p>
          </div>
        ) : (
          <form
            className="space-y-5"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              const fd = new FormData(e.currentTarget);
              if (!validate(fd)) return;
              setBusy(true);
              const res = await contactFn({
                data: {
                  name: String(fd.get("name") ?? ""),
                  email: String(fd.get("email") ?? ""),
                  message: String(fd.get("message") ?? ""),
                  website: String(fd.get("website") ?? ""),
                },
              });
              setBusy(false);
              if (!res.ok) {
                setError(`${res.code}: ${res.message}`);
                return;
              }
              setSent(true);
            }}
          >
            {/* Honeypot — leave empty; bots fill it */}
            <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <div>
              <Input
                required
                name="name"
                aria-label="Name"
                aria-invalid={Boolean(fieldErrors["name"])}
                placeholder="NAME"
                minLength={2}
                maxLength={120}
                className="h-14 rounded-none border-x-0 border-t-0 bg-transparent"
              />
              {fieldErrors["name"] && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors["name"]}</p>
              )}
            </div>
            <div>
              <Input
                required
                name="email"
                aria-label="Email"
                aria-invalid={Boolean(fieldErrors["email"])}
                type="email"
                placeholder="EMAIL"
                maxLength={320}
                className="h-14 rounded-none border-x-0 border-t-0 bg-transparent"
              />
              {fieldErrors["email"] && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors["email"]}</p>
              )}
            </div>
            <div>
              <Textarea
                required
                name="message"
                aria-label="Message"
                aria-invalid={Boolean(fieldErrors["message"])}
                placeholder="MESSAGE"
                minLength={10}
                maxLength={5000}
                className="min-h-36 rounded-none border-x-0 border-t-0 bg-transparent"
              />
              {fieldErrors["message"] && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors["message"]}</p>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button variant="signal" size="signal" type="submit" disabled={busy}>
              Send note <Send aria-hidden="true" />
            </Button>
          </form>
        )}
      </section>
    </PageShell>
  );
}
