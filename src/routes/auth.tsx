import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { BrandMark } from "@/components/vigil/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginFn, registerFn } from "@/api/dashboard";

const searchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in — VIGIL" },
      {
        name: "description",
        content: "Secure cookie session access to the VIGIL paper workspace.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "login"
          ? await loginFn({ data: { email, password } })
          : await registerFn({
              data: { email, password, displayName: displayName || undefined },
            });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await navigate({ to: (next as "/dashboard") || "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-12 text-foreground">
      <div className="w-full max-w-md border border-border bg-background p-8">
        <BrandMark />
        <h1 className="mt-8 text-3xl font-bold uppercase">
          {mode === "login" ? "Sign in" : "Create your workspace"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {mode === "register"
            ? "Creates a private tenant for you alone — your allowlist, journal, $100 paper book, and Bitget Demo keys. Nobody shares your keys."
            : "httpOnly cookie sessions · your private tenant · paper only"}
        </p>
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          {mode === "register" && (
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="DISPLAY NAME"
              className="h-12 rounded-none"
            />
          )}
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="EMAIL"
            className="h-12 rounded-none"
            autoComplete="email"
          />
          <Input
            required
            type="password"
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="PASSWORD (MIN 10)"
            className="h-12 rounded-none"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button variant="signal" size="signal" type="submit" disabled={busy} className="w-full">
            {busy ? "Working…" : mode === "login" ? "Enter my workspace" : "Create my workspace"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-6 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need a workspace? Register" : "Already registered? Sign in"}
        </button>
      </div>
    </main>
  );
}
