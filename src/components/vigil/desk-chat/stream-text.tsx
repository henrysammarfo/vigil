import { useEffect, useState, type ReactNode } from "react";
import { Copy, RefreshCw, Reply, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

const WORD_MS = 28;

/** Word-resolve stream + follow-ups (StreamingText pattern). */
export function DeskStreamText({
  text,
  animate = true,
  onDone,
  followUps = [],
  onFollowUp,
  onReply,
  onRetry,
}: {
  text: string;
  animate?: boolean;
  onDone?: () => void;
  followUps?: string[];
  onFollowUp?: (q: string) => void;
  onReply?: () => void;
  onRetry?: () => void;
}) {
  const words = text.trim().length ? text.split(/(\s+)/) : [];
  const [count, setCount] = useState(animate ? 0 : words.length);
  const done = count >= words.length;

  useEffect(() => {
    if (!animate) {
      setCount(words.length);
      onDone?.();
      return;
    }
    setCount(0);
  }, [text, animate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!animate) return;
    if (count >= words.length) {
      onDone?.();
      return;
    }
    const t = window.setTimeout(() => setCount((c) => c + 1), WORD_MS);
    return () => window.clearTimeout(t);
  }, [count, words.length, animate, onDone]);

  return (
    <div className="w-full">
      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
        {words.slice(0, count).join("")}
        {!done && (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 bg-foreground" />
        )}
      </p>

      <div
        className={cn(
          "mt-2 flex items-center gap-0.5 transition-opacity duration-300",
          done ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ActionIcon
          label="Copy"
          onClick={() => void navigator.clipboard?.writeText(text)}
          icon={<Copy className="size-3.5" />}
        />
        {onRetry && (
          <ActionIcon label="Retry" onClick={onRetry} icon={<RefreshCw className="size-3.5" />} />
        )}
        {onReply && (
          <ActionIcon label="Reply" onClick={onReply} icon={<Reply className="size-3.5" />} />
        )}
        <ActionIcon label="Helpful" icon={<ThumbsUp className="size-3.5" />} />
        <ActionIcon label="Not helpful" icon={<ThumbsDown className="size-3.5" />} />
      </div>

      {followUps.length > 0 && (
        <div
          className={cn(
            "mt-3 transition-opacity duration-400",
            done ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Follow-ups
          </p>
          <div className="mt-1 flex flex-col">
            {followUps.map((q, i) => (
              <button
                key={q}
                type="button"
                onClick={() => onFollowUp?.(q)}
                className="desk-fade-up -mx-1.5 flex items-center gap-2 border-b border-border px-1.5 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-muted/60"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="text-muted-foreground">↳</span>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionIcon({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {icon}
    </button>
  );
}
