import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Plus, Slash } from "lucide-react";
import { cn } from "@/lib/utils";
import { DESK_SLASH, type SlashCommand } from "./types";

/** Rich composer with /commands (PromptBar pattern, VIGIL tokens). */
export function DeskPromptBar({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  replySnippet,
  onClearReply,
  quotaHint,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  replySnippet?: string | null;
  onClearReply?: () => void;
  quotaHint?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !disabled;

  const slashToken = parseSlash(value);
  const rows: SlashCommand[] = slashToken
    ? DESK_SLASH.filter(
        (c) =>
          c.name.slice(1).startsWith(slashToken.query) ||
          c.key.startsWith(slashToken.query),
      )
    : menuOpen
      ? DESK_SLASH
      : [];

  useEffect(() => {
    setActive(0);
  }, [slashToken?.query, menuOpen]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 40), 140)}px`;
  }, [value]);

  const pick = (cmd: SlashCommand) => {
    onChange(cmd.prompt);
    setMenuOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div data-desk-prompt className="relative w-full">
      {rows.length > 0 && (
        <div
          className="desk-pop-in absolute inset-x-0 bottom-full z-10 mb-2 border border-border bg-background p-1 shadow-signal"
          style={{ transformOrigin: "bottom center" }}
        >
          {rows.map((row, i) => (
            <button
              key={row.key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(row)}
              className={cn(
                "flex h-9 w-full items-center gap-2.5 px-2 text-left text-[12.5px]",
                i === active ? "bg-muted" : "hover:bg-muted/60",
              )}
            >
              <Slash className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium text-foreground">{row.name}</span>
              <span className="truncate text-muted-foreground">{row.desc}</span>
            </button>
          ))}
          <div className="mt-1 border-t border-border px-2 pt-1.5 pb-1 text-[11px] text-muted-foreground">
            Type / for commands · Enter to send · Shift+Enter for newline
          </div>
        </div>
      )}

      {replySnippet && (
        <div className="mb-2 flex items-start justify-between gap-2 border border-border bg-muted/40 px-3 py-2 text-[12px]">
          <div className="min-w-0">
            <p className="font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Replying to
            </p>
            <p className="truncate text-foreground">{replySnippet.slice(0, 180)}</p>
          </div>
          <button
            type="button"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onClearReply}
          >
            Clear
          </button>
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-1.5 border border-border bg-background p-1.5 transition-[border-color] focus-within:border-primary-edge",
        )}
      >
        <div className="grid grid-cols-[28px_minmax(0,1fr)_28px_28px] items-end gap-1">
          <button
            type="button"
            aria-label="Slash commands"
            aria-expanded={menuOpen || rows.length > 0}
            disabled={disabled}
            onClick={() => {
              setMenuOpen((v) => !v);
              if (!value.startsWith("/")) onChange("/");
              inputRef.current?.focus();
            }}
            className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            value={value}
            disabled={disabled}
            placeholder={placeholder ?? "Message VIGIL Desk…"}
            aria-label="Desk chat prompt"
            onChange={(e) => {
              onChange(e.target.value);
              setMenuOpen(false);
            }}
            onKeyDown={(e) => {
              if (rows.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                setActive((c) =>
                  e.key === "ArrowDown"
                    ? (c + 1) % rows.length
                    : (c + rows.length - 1) % rows.length,
                );
                return;
              }
              if (rows.length > 0 && e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                pick(rows[active]!);
                return;
              }
              if (e.key === "Escape") {
                setMenuOpen(false);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            className="min-h-10 w-full resize-none bg-transparent px-1 py-2 text-[13px] leading-[18px] text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />

          <button
            type="button"
            aria-label="Dictation unavailable"
            disabled
            title="Dictation reserved"
            className="flex size-7 items-center justify-center text-muted-foreground opacity-40"
          >
            <Mic className="size-3.5" />
          </button>

          <button
            type="button"
            aria-label="Send"
            disabled={!canSend}
            onClick={onSend}
            className={cn(
              "flex size-7 items-center justify-center transition-[background-color,transform] enabled:active:scale-[0.94]",
              canSend
                ? "bg-ink text-ink-foreground"
                : "bg-muted text-muted-foreground opacity-60",
            )}
          >
            <ArrowUp className="size-4" strokeWidth={2.4} />
          </button>
        </div>
      </div>
      {quotaHint && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{quotaHint}</p>
      )}
    </div>
  );
}

function parseSlash(draft: string): { query: string } | null {
  const match = /(^|\s)\/([\w-]*)$/.exec(draft);
  if (!match) return null;
  return { query: match[2]!.toLowerCase() };
}
