import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Reply, SendHorizontal } from "lucide-react";
import { DashboardShell, Panel } from "@/components/vigil/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  chatQuotaFn,
  createChatThreadFn,
  listChatThreadsFn,
  listChatMessagesFn,
  sendChatMessageFn,
} from "@/api/dashboard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/chat")({
  head: () => ({
    meta: [
      { title: "Desk chat — VIGIL" },
      {
        name: "description",
        content: "Private VIGIL Desk chat with memory and hard daily caps.",
      },
    ],
  }),
  component: ChatPage,
});

type Thread = { id: string; title: string; updatedAt: string; createdAt: string };
type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  replyToId: string | null;
};

function ChatPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const refreshQuota = useCallback(async () => {
    const res = await chatQuotaFn();
    if (res.ok) setQuota(res.quota);
  }, []);

  const refreshThreads = useCallback(async () => {
    const res = await listChatThreadsFn();
    if (res.ok) {
      setThreads(res.threads);
      return res.threads;
    }
    setErr(`${res.code}: ${res.message}`);
    return [] as Thread[];
  }, []);

  const loadMessages = useCallback(async (threadId: string) => {
    const res = await listChatMessagesFn({ data: { threadId } });
    if (res.ok) {
      setMessages(res.messages);
      setErr(null);
    } else {
      setErr(`${res.code}: ${res.message}`);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshQuota();
      const list = await refreshThreads();
      if (list[0]) {
        setActiveId(list[0].id);
        await loadMessages(list[0].id);
      }
    })();
  }, [refreshQuota, refreshThreads, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function newChat() {
    setBusy(true);
    setErr(null);
    const res = await createChatThreadFn({ data: {} });
    setBusy(false);
    if (!res.ok) {
      setErr(`${res.code}: ${res.message}`);
      return;
    }
    setActiveId(res.thread.id);
    setMessages([]);
    setReplyTo(null);
    await refreshThreads();
  }

  async function selectThread(id: string) {
    setActiveId(id);
    setReplyTo(null);
    setErr(null);
    await loadMessages(id);
  }

  async function send() {
    if (!activeId || !draft.trim() || busy) return;
    if (quota && quota.remaining <= 0) {
      setErr(`Daily chat cap reached (${quota.used}/${quota.limit}). Try again tomorrow.`);
      return;
    }
    setBusy(true);
    setErr(null);
    const content = draft.trim();
    setDraft("");
    const res = await sendChatMessageFn({
      data: {
        threadId: activeId,
        content,
        replyToId: replyTo?.id ?? null,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setDraft(content);
      setErr(`${res.code}: ${res.message}`);
      await refreshQuota();
      return;
    }
    setMessages((prev) => [...prev, res.userMessage, res.assistantMessage]);
    setQuota({
      used: res.quota.used,
      limit: res.quota.limit,
      remaining: Math.max(0, res.quota.limit - res.quota.used),
    });
    setReplyTo(null);
    await refreshThreads();
  }

  const capped = quota != null && quota.remaining <= 0;

  return (
    <DashboardShell
      title="Desk chat"
      kicker={
        quota
          ? `Memory threads · ${quota.remaining}/${quota.limit} messages left today (UTC)`
          : "Private workspace assistant"
      }
      actions={
        <Button variant="signal" size="sm" onClick={() => void newChat()} disabled={busy}>
          <MessageSquarePlus className="mr-1.5 size-3.5" />
          New chat
        </Button>
      }
    >
      <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[220px_1fr]">
        <Panel title="Conversations" meta="Saved">
          <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
            {threads.length === 0 && (
              <li className="px-1 py-3 text-xs text-muted-foreground">No chats yet.</li>
            )}
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => void selectThread(t.id)}
                  className={cn(
                    "w-full truncate border border-transparent px-2 py-2 text-left text-xs transition-colors",
                    activeId === t.id
                      ? "border-border bg-muted font-semibold"
                      : "hover:bg-muted/60",
                  )}
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title={threads.find((t) => t.id === activeId)?.title ?? "VIGIL Desk"}
          meta="Hard daily cap · keys stay server-side"
          className="flex min-h-[70vh] flex-col"
        >
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1" style={{ maxHeight: "52vh" }}>
            {!activeId && (
              <p className="text-sm text-muted-foreground">
                Start a new chat to ask about your journal, allowlist, or $100→$5k growth book.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "border border-border px-3 py-2 text-sm",
                  m.role === "user" ? "ml-8 bg-muted/40" : "mr-4 bg-surface",
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {m.role === "user" ? "You" : "VIGIL Desk"}
                  </span>
                  {m.role === "assistant" && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                      onClick={() => setReplyTo(m)}
                      title="Reply to this answer"
                    >
                      <Reply className="size-3" />
                      Reply
                    </button>
                  )}
                </div>
                {m.replyToId && (
                  <p className="mb-2 border-l-2 border-border pl-2 text-[11px] text-muted-foreground">
                    Replying to a prior message
                  </p>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              </div>
            ))}
            {busy && (
              <p className="text-xs text-muted-foreground animate-pulse">Desk is thinking…</p>
            )}
            <div ref={bottomRef} />
          </div>

          {replyTo && (
            <div className="mt-3 flex items-start justify-between gap-2 border border-border bg-muted/30 px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="uppercase tracking-wide text-muted-foreground">Replying to</p>
                <p className="truncate">{replyTo.content.slice(0, 160)}</p>
              </div>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setReplyTo(null)}
              >
                Clear
              </button>
            </div>
          )}

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Input
              className="rounded-none"
              placeholder={
                capped
                  ? "Daily cap reached — try tomorrow"
                  : activeId
                    ? "Ask about your paper book, allowlist, or why-cards…"
                    : "Create a chat first"
              }
              value={draft}
              disabled={!activeId || busy || capped}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
            />
            <Button
              type="submit"
              variant="signal"
              disabled={!activeId || busy || capped || !draft.trim()}
            >
              <SendHorizontal className="size-4" />
            </Button>
          </form>
          {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Free / hackathon mode: {quota?.limit ?? 3} user messages per person per UTC day. Platform
            LLM keys never leave the server. Chat cannot place trades — use Run agent + Settings.
          </p>
        </Panel>
      </div>
    </DashboardShell>
  );
}
