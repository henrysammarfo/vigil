import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  chatQuotaFn,
  createChatThreadFn,
  dashboardOverviewFn,
  listChatMessagesFn,
  listChatThreadsFn,
  sendChatMessageFn,
} from "@/api/dashboard";
import { cn } from "@/lib/utils";
import { DeskChatSidebar } from "./sidebar";
import { DeskContextCards, DeskQuickActions } from "./context-cards";
import { DeskPromptBar } from "./prompt-bar";
import { DeskLoading, DeskThinking } from "./thinking";
import { DeskStreamText } from "./stream-text";
import { DeskSelectionBar } from "./selection-bar";
import { DeskApprovalCard } from "./approval-card";
import {
  DESK_FOLLOW_UPS,
  type DeskContextChunk,
  type DeskMessage,
  type DeskQuota,
  type DeskThread,
} from "./types";

export function DeskChatApp() {
  const [threads, setThreads] = useState<DeskThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DeskMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<DeskMessage | null>(null);
  const [quota, setQuota] = useState<DeskQuota | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "thinking" | "streaming">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [selection, setSelection] = useState("");
  const [chunks, setChunks] = useState<DeskContextChunk[]>([]);
  const [streamIds, setStreamIds] = useState<Set<string>>(new Set());
  const [focusHint, setFocusHint] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

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
    return [] as DeskThread[];
  }, []);

  const loadMessages = useCallback(async (threadId: string) => {
    const res = await listChatMessagesFn({ data: { threadId } });
    if (res.ok) {
      setMessages(res.messages);
      setStreamIds(new Set());
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
      const overview = await dashboardOverviewFn();
      if (overview.ok) {
        const next: DeskContextChunk[] = [];
        if (overview.growth) {
          next.push({
            title: "Growth book",
            body: `Equity $${overview.growth.equityUsd?.toFixed?.(2) ?? "—"} · target $${overview.growth.targetUsd} · start $${overview.growth.startUsd}`,
            source: "Paper ledger",
            badge: "BOOK",
          });
        }
        if (overview.settings) {
          const al = Array.isArray(overview.settings.allowlist)
            ? overview.settings.allowlist.join(", ")
            : "(empty)";
          next.push({
            title: "FENN allowlist",
            body: al || "(empty — refuse by default)",
            source: "Settings",
            badge: "RULE",
          });
        }
        if (overview.window) {
          next.push({
            title: "Closed window",
            body: `${overview.window.state}${overview.window.allowed ? " · agent may run" : " · standing down"}`,
            source: "Session clock",
            badge: "GATE",
          });
        }
        if (overview.bitget) {
          next.push({
            title: "Bitget Demo",
            body: overview.bitget.configured
              ? `Connected · hint ${overview.bitget.keyHint ?? "••••"}`
              : "Not connected — Settings → Your Bitget Demo",
            source: "Tenant vault",
            badge: "KEY",
          });
        }
        setChunks(next.slice(0, 4));
      }
    })();
  }, [refreshQuota, refreshThreads, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, phase]);

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
    setDraft("");
    setPhase("idle");
    await refreshThreads();
  }

  async function selectThread(id: string) {
    setActiveId(id);
    setReplyTo(null);
    setErr(null);
    setPhase("idle");
    await loadMessages(id);
  }

  async function sendText(raw: string) {
    let threadId = activeId;
    if (!threadId) {
      const created = await createChatThreadFn({ data: {} });
      if (!created.ok) {
        setErr(`${created.code}: ${created.message}`);
        return;
      }
      threadId = created.thread.id;
      setActiveId(threadId);
      setMessages([]);
    }
    if (!raw.trim() || busy) return;
    if (quota && quota.remaining <= 0) {
      setErr(`Daily chat cap reached (${quota.used}/${quota.limit}). Try again tomorrow.`);
      return;
    }

    setBusy(true);
    setPhase("thinking");
    setErr(null);
    const content = raw.trim();
    setDraft("");

    // Optimistic user bubble
    const tempUser: DeskMessage = {
      id: `tmp_${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      replyToId: replyTo?.id ?? null,
    };
    setMessages((prev) => [...prev, tempUser]);

    const res = await sendChatMessageFn({
      data: {
        threadId,
        content,
        replyToId: replyTo?.id ?? null,
      },
    });

    if (!res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
      setDraft(content);
      setBusy(false);
      setPhase("idle");
      setErr(`${res.code}: ${res.message}`);
      await refreshQuota();
      return;
    }

    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempUser.id);
      return [...withoutTemp, res.userMessage, res.assistantMessage];
    });
    setStreamIds(new Set([res.assistantMessage.id]));
    setQuota({
      used: res.quota.used,
      limit: res.quota.limit,
      remaining: Math.max(0, res.quota.limit - res.quota.used),
    });
    setReplyTo(null);
    setBusy(false);
    setPhase("streaming");
    await refreshThreads();
  }

  function onThreadMouseUp() {
    const sel = window.getSelection()?.toString().trim() ?? "";
    if (sel.length > 8) setSelection(sel.slice(0, 500));
    else setSelection("");
  }

  const capped = quota != null && quota.remaining <= 0;
  const activeTitle = threads.find((t) => t.id === activeId)?.title ?? "VIGIL Desk";
  const empty = messages.length === 0 && !busy;
  const followUps = useMemo(() => DESK_FOLLOW_UPS, []);

  return (
    <div className="flex min-h-[78vh] overflow-hidden border border-border bg-surface">
      <DeskChatSidebar
        threads={threads}
        activeId={activeId}
        quotaLabel={
          quota ? `${quota.remaining}/${quota.limit}` : "…"
        }
        onNewChat={() => void newChat()}
        onPick={(id) => void selectThread(id)}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">
              {activeTitle}
            </p>
            <p className="text-[11px] text-muted-foreground">
              One trading agent per workspace · chat is capped desk only
            </p>
          </div>
          <Link
            to="/dashboard/settings"
            className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
          >
            Agent params →
          </Link>
        </header>

        <div
          ref={threadRef}
          className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8"
          onMouseUp={onThreadMouseUp}
        >
          <DeskSelectionBar
            selectedText={selection}
            onClear={() => {
              setSelection("");
              window.getSelection()?.removeAllRanges();
            }}
            onAction={(prompt) => {
              setDraft(prompt);
              setSelection("");
              window.getSelection()?.removeAllRanges();
            }}
          />

          {empty && (
            <div className="mx-auto grid max-w-2xl gap-4 desk-fade-up">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-[0.06em] text-foreground">
                  VIGIL Desk
                </h2>
                <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                  ChatGPT-style memory for your private paper workspace. Hard{" "}
                  {quota?.limit ?? 3} messages / UTC day. Keys never leave the server.
                </p>
              </div>
              <DeskApprovalCard
                onDone={(summary) => {
                  setFocusHint(summary);
                  setDraft((d) => d || summary);
                }}
              />
              <DeskContextCards chunks={chunks} />
              <DeskQuickActions
                remaining={quota?.remaining ?? 0}
                onPick={(p) => void sendText(focusHint ? `${focusHint}\n\n${p}` : p)}
              />
            </div>
          )}

          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {messages.map((m) => {
              if (m.role === "system") return null;
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={cn(
                    "desk-fade-up",
                    isUser ? "ml-8 flex justify-end md:ml-16" : "mr-4 md:mr-10",
                  )}
                >
                  {isUser ? (
                    <div className="max-w-[92%] border border-border bg-muted/50 px-3 py-2 text-[13.5px] leading-relaxed text-foreground">
                      {m.replyToId && (
                        <p className="mb-1.5 border-l-2 border-primary-edge pl-2 text-[11px] text-muted-foreground">
                          Reply in thread
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ) : (
                    <div className="w-full">
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        VIGIL Desk
                      </p>
                      {m.replyToId && (
                        <p className="mb-2 border-l-2 border-border pl-2 text-[11px] text-muted-foreground">
                          Answering a reply
                        </p>
                      )}
                      <DeskStreamText
                        text={m.content}
                        animate={streamIds.has(m.id)}
                        onDone={() => {
                          setStreamIds((prev) => {
                            const next = new Set(prev);
                            next.delete(m.id);
                            return next;
                          });
                          setPhase("idle");
                        }}
                        followUps={
                          m.id === messages[messages.length - 1]?.id && !busy
                            ? followUps
                            : []
                        }
                        onFollowUp={(q) => void sendText(q)}
                        onReply={() => setReplyTo(m)}
                        onRetry={() => {
                          const lastUser = [...messages]
                            .reverse()
                            .find((x) => x.role === "user");
                          if (lastUser) void sendText(lastUser.content);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {busy && phase === "thinking" && (
              <div className="mr-4 space-y-3 md:mr-10">
                <DeskThinking working />
                <DeskLoading label="Desk drafting" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-background px-4 py-3 md:px-8">
          <div className="mx-auto max-w-2xl">
            {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
            <DeskPromptBar
              value={draft}
              onChange={setDraft}
              onSend={() => void sendText(draft)}
              disabled={busy || capped}
              placeholder={
                capped
                  ? "Daily cap reached — try tomorrow"
                  : "Ask about journal, allowlist, growth…  (/ for commands)"
              }
              replySnippet={replyTo?.content ?? null}
              onClearReply={() => setReplyTo(null)}
              {...(quota
                ? {
                    quotaHint: `Free mode · ${quota.remaining}/${quota.limit} left today (UTC) · chat cannot place trades`,
                  }
                : {})}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
