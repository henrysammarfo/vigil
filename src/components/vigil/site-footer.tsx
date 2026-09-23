import { Link } from "@tanstack/react-router";

const legal = [
  { to: "/privacy" as const, label: "Privacy" },
  { to: "/terms" as const, label: "Terms" },
  { to: "/contact" as const, label: "Contact" },
];

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer
      className={
        compact
          ? "flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-8 text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:px-[8vw]"
          : "border-t border-border bg-surface px-5 py-10 text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:px-[8vw]"
      }
    >
      <div className="flex flex-wrap items-center gap-4 md:gap-8">
        <span>VIGIL / Paper simulation only · not financial advice</span>
        <nav className="flex flex-wrap gap-4" aria-label="Legal">
          {legal.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-primary">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <span className="mt-4 block md:mt-0">Built by Henry Sam Marfo · ATU</span>
    </footer>
  );
}
