import { createFileRoute } from "@tanstack/react-router";
import { Github, Send } from "lucide-react";
import { PageShell } from "@/components/vigil/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { contactFn } from "@/api/dashboard";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact VIGIL — Henry Sam Marfo" },
      { name: "description", content: "Contact the creator of VIGIL." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
          >
            X · @henrysammarfo
          </a>
          <a
            className="flex items-center gap-3 border-y border-border py-5 font-bold uppercase hover:text-primary"
            href="https://github.com/henrysammarfo"
          >
            <Github /> GitHub
          </a>
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
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              const fd = new FormData(e.currentTarget);
              const res = await contactFn({
                data: {
                  name: String(fd.get("name") ?? ""),
                  email: String(fd.get("email") ?? ""),
                  message: String(fd.get("message") ?? ""),
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
            <Input
              required
              name="name"
              aria-label="Name"
              placeholder="NAME"
              className="h-14 rounded-none border-x-0 border-t-0 bg-transparent"
            />
            <Input
              required
              name="email"
              aria-label="Email"
              type="email"
              placeholder="EMAIL"
              className="h-14 rounded-none border-x-0 border-t-0 bg-transparent"
            />
            <Textarea
              required
              name="message"
              aria-label="Message"
              placeholder="MESSAGE"
              className="min-h-36 rounded-none border-x-0 border-t-0 bg-transparent"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button variant="signal" size="signal" type="submit" disabled={busy}>
              Send note <Send />
            </Button>
          </form>
        )}
      </section>
    </PageShell>
  );
}
