import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Pixel-grid loader + shimmer label + elapsed timer (LoadingState pattern). */
export function DeskLoading({
  label = "Desk thinking",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const [ds, setDs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDs((d) => d + 1), 100);
    return () => clearInterval(t);
  }, []);
  const total = ds / 10;
  const elapsed =
    total < 60 ? `${total.toFixed(1)}s` : `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;

  const delays = Array.from({ length: 9 }, (_, i) => {
    const r = Math.floor(i / 3);
    const c = i % 3;
    return (c + Math.abs(r - 1)) * 90;
  });

  return (
    <div role="status" className={cn("flex w-fit items-center gap-2.5", className)}>
      <span aria-hidden className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]">
        {delays.map((delay, index) => (
          <span
            key={index}
            className="size-1 rounded-[1px] bg-foreground"
            style={{
              opacity: 0.15,
              animation: `desk-pixel-on 650ms ease-in-out ${delay}ms infinite`,
            }}
          />
        ))}
      </span>
      <span className="desk-shimmer text-[13px] font-medium">{label}</span>
      <span className="font-mono text-[12px] tabular-nums text-muted-foreground">{elapsed}</span>
    </div>
  );
}

/** Expandable agent trace (ThinkingState pattern). */
export function DeskThinking({
  working,
  rows = ["Reading workspace journal", "Checking allowlist + growth book", "Drafting desk reply"],
}: {
  working: boolean;
  rows?: string[];
}) {
  const [open, setOpen] = useState(true);
  const visible = working ? Math.min(rows.length, 2) : rows.length;

  return (
    <div className="desk-fade-up w-full max-w-xl">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-sm px-1.5 py-1 transition-colors hover:bg-muted"
      >
        {working ? (
          <span
            className="size-3 shrink-0 rounded-full border-[1.5px] border-border border-t-foreground"
            style={{ animation: "desk-spin 700ms linear infinite" }}
          />
        ) : (
          <span className="text-[13px] text-muted-foreground">✦</span>
        )}
        {working ? (
          <span className="desk-shimmer text-[13px] font-medium">Thinking</span>
        ) : (
          <span className="text-[13px] font-medium text-muted-foreground">Thought for a moment</span>
        )}
        <span
          className="text-muted-foreground transition-transform duration-300"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
        >
          ▾
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <ul className="relative ml-2 mt-1 space-y-1 border-l border-border py-1 pl-4">
            {rows.slice(0, visible).map((row, i) => (
              <li
                key={row}
                className="flex items-center gap-2 text-[12.5px] text-muted-foreground desk-fade-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {i < visible - 1 || !working ? (
                  <span className="text-foreground">✓</span>
                ) : (
                  <span
                    className="size-2.5 shrink-0 rounded-full border border-border border-t-foreground"
                    style={{ animation: "desk-spin 700ms linear infinite" }}
                  />
                )}
                {row}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
