import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BrandMark({
  inverse = false,
  compact = false,
}: {
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      to="/"
      aria-label="VIGIL home"
      className={cn(
        "group inline-flex items-center gap-3",
        inverse ? "text-ink-foreground" : "text-foreground",
      )}
    >
      <svg
        viewBox="0 0 48 48"
        className="h-10 w-10"
        role="img"
        aria-label="VIGIL eye and market pulse mark"
      >
        <path
          d="M4 24C10 13 17 8 24 8s14 5 20 16c-6 11-13 16-20 16S10 35 4 24Z"
          fill="currentColor"
        />
        <path
          d="m11 25 7-6 6 11 6-16 7 10"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinejoin="bevel"
        />
      </svg>
      {!compact && <span className="text-2xl font-bold uppercase tracking-[0.08em]">Vigil</span>}
    </Link>
  );
}

const links = [
  { to: "/", label: "Home" },
  { to: "/how-it-works", label: "System" },
  { to: "/journal", label: "Journal" },
  { to: "/about", label: "About" },
  { to: "/brand", label: "Brand" },
  { to: "/contact", label: "Contact" },
] as const;
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-30 flex items-center gap-8 px-5 pt-6 md:px-12 md:pt-9">
      <BrandMark />
      <nav className="hidden items-center gap-8 md:flex">
        {links.map((x) => (
          <Link
            key={x.to}
            to={x.to}
            activeProps={{ className: "text-primary" }}
            className="text-xs font-bold uppercase tracking-[0.08em] text-foreground hover:text-primary"
          >
            {x.label}
          </Link>
        ))}
      </nav>
      <Button
        variant={overlay ? "ink" : "outline"}
        size="sm"
        asChild
        className="ml-auto hidden md:inline-flex"
      >
        <Link to="/auth" search={{ next: "/dashboard" }}>
          Create workspace
        </Link>
      </Button>
      <Button
        variant="ink"
        size="icon"
        className="ml-auto md:hidden"
        aria-label="Toggle menu"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </Button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-ink/40 md:hidden"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute left-5 right-5 top-20 z-50 flex flex-col gap-5 border border-border bg-background p-6 shadow-xl md:hidden">
            {links.map((x) => (
              <Link
                key={x.to}
                to={x.to}
                onClick={() => setOpen(false)}
                className="font-bold uppercase"
              >
                {x.label}
              </Link>
            ))}
            <Link
              to="/auth"
              search={{ next: "/dashboard" }}
              onClick={() => setOpen(false)}
              className="font-bold uppercase text-primary"
            >
              Create workspace
            </Link>
          </nav>
        </>
      )}
    </header>
  );
}
