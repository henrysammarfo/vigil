import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  BookOpenCheck,
  ChevronRight,
  CircleUserRound,
  Gauge,
  LogOut,
  Menu,
  Play,
  Settings,
  ShieldCheck,
  ShoppingCart,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { BrandMark } from "./brand";
import { useWindowStatus } from "./dashboard-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutFn } from "@/api/dashboard";

const nav = [
  ["/dashboard", Gauge, "Overview"],
  ["/dashboard/signals", Activity, "Signals"],
  ["/dashboard/trades", ShoppingCart, "Paper trades"],
  ["/dashboard/journal", BookOpenCheck, "Why-log"],
  ["/dashboard/replay", Play, "Replay"],
  ["/dashboard/settings", Settings, "Settings"],
] as const;

export function DashboardShell({
  title,
  kicker,
  children,
  actions,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const windowQ = useWindowStatus();
  const windowState = windowQ.data?.ok ? windowQ.data.window.state : "…";
  const vigilActive = windowQ.data?.ok ? windowQ.data.window.allowed : false;

  return (
    <div className="min-h-screen bg-surface text-foreground md:grid md:grid-cols-[238px_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[238px] flex-col bg-ink p-5 text-ink-foreground transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <BrandMark inverse />
          <Button
            variant="ghost"
            size="icon"
            className="text-ink-foreground md:hidden"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </div>
        <div className="mt-8 flex items-center gap-2 border-y border-ink-border py-4 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
          <span
            className={cn("h-2 w-2", vigilActive ? "animate-pulse bg-primary" : "bg-ink-muted")}
          />
          {vigilActive ? `Vigil active · ${windowState}` : `Standing down · ${windowState}`}
        </div>
        <nav className="mt-6 space-y-1">
          {nav.map(([to, I, label]) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-3 text-xs font-bold uppercase tracking-[0.06em] text-ink-muted hover:bg-ink-border hover:text-ink-foreground",
                path === to && "bg-ink-border text-primary",
              )}
            >
              <I className="h-4 w-4" />
              {label}
              <ChevronRight className="ml-auto h-3 w-3" />
            </Link>
          ))}
        </nav>
        <div className="mt-auto border border-ink-border p-4">
          <p className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Execution mode</p>
          <p className="mt-2 flex items-center gap-2 text-xs font-bold uppercase">
            <ShieldCheck className="h-4 w-4 text-primary" /> Paper only
          </p>
        </div>
      </aside>
      <div className="md:col-start-2">
        <header className="sticky top-0 z-40 flex h-20 items-center border-b border-border bg-surface/95 px-5 backdrop-blur md:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="mr-3 md:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </Button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {kicker}
            </p>
            <h1 className="mt-1 text-lg font-bold uppercase">{title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <Button variant="outline" size="icon" aria-label="Notifications">
              <Bell />
            </Button>
            <Button
              variant="ink"
              size="icon"
              aria-label="Sign out"
              onClick={async () => {
                await logoutFn();
                window.location.href = "/auth";
              }}
            >
              <LogOut />
            </Button>
            <Button variant="ink" size="icon" aria-label="Account">
              <CircleUserRound />
            </Button>
          </div>
        </header>
        <main className="p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function Panel({
  title,
  meta,
  children,
  className,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border border-border bg-background", className)}>
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em]">{title}</h2>
        {meta && <span className="text-[10px] uppercase text-muted-foreground">{meta}</span>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
