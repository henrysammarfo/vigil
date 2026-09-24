import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, RefreshCw, Scissors, Sparkles, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Floating selection AI bar (SelectionActions pattern). */
export function DeskSelectionBar({
  selectedText,
  onAction,
  onClear,
}: {
  selectedText: string;
  onAction: (action: string, snippet: string) => void;
  onClear: () => void;
}) {
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !selectedText) {
      setVisible(false);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const host = hostRef.current?.offsetParent as HTMLElement | null;
    const hostRect = host?.getBoundingClientRect();
    if (!hostRect) return;
    setAnchor({
      x: rect.left - hostRect.left + rect.width / 2,
      y: rect.bottom - hostRect.top + 8,
    });
    setVisible(true);
  }, [selectedText]);

  useEffect(() => {
    const onScroll = () => onClear();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [onClear]);

  if (!selectedText.trim()) return null;

  const actions = [
    { id: "Explain", icon: <Wand2 className="size-3.5" />, prompt: "Explain this in plain English:\n" },
    { id: "Improve", icon: <Sparkles className="size-3.5" />, prompt: "Improve and tighten:\n" },
    { id: "Shorten", icon: <Scissors className="size-3.5" />, prompt: "Shorten to 2 sentences:\n" },
  ];

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 z-20"
      aria-hidden={!visible}
    >
      <div
        className={cn(
          "pointer-events-auto absolute desk-pop-in flex h-9 items-center gap-0.5 border border-border bg-background px-1 shadow-signal",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{
          left: anchor.x,
          top: anchor.y,
          transform: "translateX(-50%)",
        }}
      >
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className="inline-flex h-7 items-center gap-1 px-2 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
            onClick={() => onAction(a.prompt + selectedText.slice(0, 400), selectedText)}
          >
            {a.icon}
            {a.id}
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px bg-border" />
        <button
          type="button"
          aria-label="Dismiss selection bar"
          className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={onClear}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function DeskKeepDiscard({
  onKeep,
  onDiscard,
  onRetry,
}: {
  onKeep: () => void;
  onDiscard: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="desk-pop-in mt-2 flex items-center gap-1.5">
      <button
        type="button"
        onClick={onKeep}
        className="inline-flex h-7 items-center gap-1 bg-ink px-2.5 text-[12px] font-medium text-ink-foreground"
      >
        <Check className="size-3.5" />
        Keep
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className="inline-flex h-7 items-center gap-1 border border-border px-2.5 text-[12px] text-muted-foreground hover:bg-muted"
      >
        <X className="size-3.5" />
        Discard
      </button>
      <button
        type="button"
        aria-label="Try again"
        onClick={onRetry}
        className="flex size-7 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <RefreshCw className="size-3.5" />
      </button>
    </div>
  );
}
