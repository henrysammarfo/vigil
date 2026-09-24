import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Q = { q: string; type: "radio" | "check"; options: string[] };

const QUESTIONS: Q[] = [
  {
    q: "What should Desk prioritize in answers?",
    type: "radio",
    options: ["Growth book ($100→$5k)", "Why-cards / refusals", "Allowlist + FENN gates"],
  },
  {
    q: "Reminders before Run agent?",
    type: "check",
    options: ["Bitget Demo connected", "Allowlist not empty", "Closed window only"],
  },
];

/** Human-in-the-loop card (ApprovalCard pattern) — seeds first Desk focus. */
export function DeskApprovalCard({
  onDone,
}: {
  onDone: (summary: string) => void;
}) {
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [sent, setSent] = useState(false);
  const [viewportH, setViewportH] = useState<number | undefined>();
  const [trackY, setTrackY] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  const last = qi === QUESTIONS.length - 1;
  const selected = answers[qi] ?? [];
  const hasAnswer = selected.length > 0;

  useLayoutEffect(() => {
    const el = refs.current[qi];
    if (!el) return;
    setViewportH(el.offsetHeight);
    setTrackY(el.offsetTop);
  }, [qi, answers]);

  useEffect(() => {
    if (!sent) return;
    const focus = QUESTIONS[0]!.options[answers[0]?.[0] ?? 0]!;
    const checks = (answers[1] ?? [])
      .map((i) => QUESTIONS[1]!.options[i])
      .filter(Boolean)
      .join(", ");
    onDone(
      `Prioritize: ${focus}.${checks ? ` Before Run agent check: ${checks}.` : ""} Keep answers short and never ask for API keys.`,
    );
  }, [sent]); // eslint-disable-line react-hooks/exhaustive-deps

  if (sent) {
    return (
      <div className="desk-pop-in inline-flex items-center gap-2 border border-border bg-muted/40 px-3 py-2 text-[12.5px] text-foreground">
        <span className="flex size-5 items-center justify-center bg-primary text-[10px] font-bold text-primary-foreground">
          ✓
        </span>
        Desk focus saved for this session
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm overflow-hidden border border-border bg-background shadow-signal desk-fade-up">
      <div className="p-4">
        <div className="overflow-hidden" style={{ height: viewportH }}>
          <div
            className="flex flex-col gap-6 transition-transform duration-300"
            style={{
              transform: `translate3d(0, ${-trackY}px, 0)`,
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {QUESTIONS.map((question, qIdx) => {
              const active = qIdx === qi;
              const picked = answers[qIdx] ?? [];
              return (
                <div
                  key={question.q}
                  ref={(el) => {
                    refs.current[qIdx] = el;
                  }}
                  aria-hidden={!active}
                  style={{ opacity: active ? 1 : 0, pointerEvents: active ? undefined : "none" }}
                >
                  <p className="pr-4 text-[14px] font-medium text-foreground">{question.q}</p>
                  <div className="mt-2.5 flex flex-col gap-1">
                    {question.options.map((option, i) => {
                      const on = picked.includes(i);
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={on}
                          tabIndex={active ? 0 : -1}
                          onClick={() => {
                            if (!active) return;
                            setAnswers((cur) => {
                              const prev = cur[qIdx] ?? [];
                              const next =
                                question.type === "radio"
                                  ? [i]
                                  : prev.includes(i)
                                    ? prev.filter((x) => x !== i)
                                    : [...prev, i];
                              return { ...cur, [qIdx]: next };
                            });
                            if (question.type === "radio") {
                              window.setTimeout(() => {
                                if (qIdx === QUESTIONS.length - 1) setSent(true);
                                else setQi((c) => Math.min(QUESTIONS.length - 1, c + 1));
                              }, 380);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-muted",
                            on ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center border text-[9px]",
                              question.type === "radio" ? "rounded-full" : "rounded-[3px]",
                              on
                                ? "border-foreground bg-foreground text-background"
                                : "border-border",
                            )}
                          >
                            {on ? "✓" : ""}
                          </span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="text-[12px] tabular-nums text-muted-foreground">
          {qi + 1} / {QUESTIONS.length}
        </span>
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (last ? setSent(true) : setQi((c) => c + 1))}
          >
            Skip
          </Button>
          <Button
            variant="ink"
            size="sm"
            disabled={!hasAnswer && !last}
            onClick={() => (last ? setSent(true) : setQi((c) => c + 1))}
          >
            {last ? "Save" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
