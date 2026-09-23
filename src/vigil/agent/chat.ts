/**
 * Tenant chat — ChatGPT-style threads with hard daily caps.
 * Uses platform LLM keys server-side only; never returns secrets.
 * Free/hackathon mode: tiny quota per tenant per UTC day.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { chatMessages, chatThreads } from "../db/schema";
import { newId } from "../security/crypto";
import { VigilError } from "../security/errors";
import { chatDailyLimit, getDailyCount, tryConsumeDaily } from "../security/usage";
import { buildMemoryDigest } from "../agent/memory";
import { listEnrichedPaperOrders, paperScoreboard } from "../agent/paper-ledger";
import { HIGH_WR_PLAYBOOKS, highWrSummary } from "../agent/playbooks/index";
import { GROWTH_TARGET_USD } from "../agent/growth";

export type ChatMessageDto = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  replyToId: string | null;
};

export type ChatThreadDto = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
};

const SYSTEM_CHAT = `You are VIGIL Desk — a concise assistant for the user's private paper-trading workspace.
Rules:
- Paper / Bitget Demo only. Never encourage live trading. Not financial advice.
- Never ask for or reveal API keys, secrets, passwords, or env values.
- Prefer short, actionable answers about their journal, allowlist, $100→$5000 growth book, and high-WR playbooks.
- If asked to place trades, explain they must use Run agent / Settings — you cannot place orders from chat.
- If context is missing, say what they should check in Settings or Terminal.`;

export async function listThreads(tenantId: string, limit = 40): Promise<ChatThreadDto[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.tenantId, tenantId))
    .orderBy(desc(chatThreads.updatedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createThread(tenantId: string, title?: string): Promise<ChatThreadDto> {
  const db = await getDb();
  const id = newId("cth");
  const now = new Date();
  const t = (title?.trim() || "New chat").slice(0, 80);
  await db.insert(chatThreads).values({
    id,
    tenantId,
    title: t,
    createdAt: now,
    updatedAt: now,
  });
  return { id, title: t, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

export async function getThreadMessages(
  tenantId: string,
  threadId: string,
): Promise<ChatMessageDto[]> {
  const db = await getDb();
  const thread = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.tenantId, tenantId)))
    .limit(1);
  if (!thread[0]) throw new VigilError("NOT_FOUND", "Chat thread not found", 404);

  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.threadId, threadId), eq(chatMessages.tenantId, tenantId)))
    .orderBy(asc(chatMessages.createdAt))
    .limit(200);

  return rows.map((r) => ({
    id: r.id,
    role: r.role as "user" | "assistant" | "system",
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    replyToId: r.replyToId,
  }));
}

async function workspaceContext(tenantId: string): Promise<string> {
  const orders = await listEnrichedPaperOrders(tenantId, 30);
  const sb = paperScoreboard(orders);
  const mem = await buildMemoryDigest({ tenantId, ticker: "NVDA", movePct: 0 });
  const lines = [
    `equity=$${sb.bankroll.equityUsd.toFixed(2)} start=$100 target=$${GROWTH_TARGET_USD}`,
    `open=${sb.open} closed=${sb.closed} wins=${sb.wins} losses=${sb.losses}`,
    `playbooks: ${highWrSummary().join(" · ")}`,
    `memory NVDA: ${mem.blockLines.slice(0, 4).join(" | ") || "thin"}`,
    `pairs: ${Object.keys(HIGH_WR_PLAYBOOKS).join(",")}`,
  ];
  return lines.join("\n");
}

export async function sendChatMessage(input: {
  tenantId: string;
  userId: string;
  threadId: string;
  content: string;
  replyToId?: string | null;
}): Promise<{
  userMessage: ChatMessageDto;
  assistantMessage: ChatMessageDto;
  quota: { used: number; limit: number; dayKey: string };
}> {
  const content = input.content.trim().slice(0, 2000);
  if (content.length < 1) {
    throw new VigilError("VALIDATION_ERROR", "Message required", 400);
  }

  const limit = chatDailyLimit();
  const consume = await tryConsumeDaily(input.tenantId, "chat", limit);
  if (!consume.allowed) {
    throw new VigilError(
      "RATE_LIMITED",
      `Daily chat cap reached (${consume.count}/${consume.limit} UTC day ${consume.dayKey}). Hackathon free mode — try tomorrow or tighten questions in Settings/Terminal without chat.`,
      429,
    );
  }

  const db = await getDb();
  const thread = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.id, input.threadId), eq(chatThreads.tenantId, input.tenantId)))
    .limit(1);
  if (!thread[0]) throw new VigilError("NOT_FOUND", "Chat thread not found", 404);

  if (input.replyToId) {
    const parent = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.id, input.replyToId),
          eq(chatMessages.threadId, input.threadId),
          eq(chatMessages.tenantId, input.tenantId),
        ),
      )
      .limit(1);
    if (!parent[0]) {
      throw new VigilError("VALIDATION_ERROR", "replyTo message not in this thread", 400);
    }
  }

  const userId = newId("cmsg");
  const now = new Date();
  await db.insert(chatMessages).values({
    id: userId,
    threadId: input.threadId,
    tenantId: input.tenantId,
    role: "user",
    content,
    replyToId: input.replyToId ?? null,
    createdAt: now,
  });

  // Title from first user message
  if (thread[0].title === "New chat") {
    await db
      .update(chatThreads)
      .set({ title: content.slice(0, 60), updatedAt: now })
      .where(eq(chatThreads.id, input.threadId));
  } else {
    await db
      .update(chatThreads)
      .set({ updatedAt: now })
      .where(eq(chatThreads.id, input.threadId));
  }

  const history = await getThreadMessages(input.tenantId, input.threadId);
  const ctx = await workspaceContext(input.tenantId);
  const replySnippet = input.replyToId
    ? history.find((m) => m.id === input.replyToId)?.content.slice(0, 400)
    : null;

  let assistantText: string;
  try {
    assistantText = await callChatLlm({
      history: history.slice(-12),
      workspace: ctx,
      replySnippet: replySnippet ?? null,
    });
  } catch (e) {
    assistantText =
      e instanceof Error
        ? `VIGIL Desk could not reach the model (${e.message.slice(0, 120)}). Check AgentRouter/Tor later; your quota was still counted.`
        : "VIGIL Desk model unavailable. Quota was still counted.";
  }

  const asstId = newId("cmsg");
  const asstAt = new Date();
  await db.insert(chatMessages).values({
    id: asstId,
    threadId: input.threadId,
    tenantId: input.tenantId,
    role: "assistant",
    content: assistantText.slice(0, 8000),
    replyToId: input.replyToId ?? null,
    createdAt: asstAt,
  });
  await db
    .update(chatThreads)
    .set({ updatedAt: asstAt })
    .where(eq(chatThreads.id, input.threadId));

  return {
    userMessage: {
      id: userId,
      role: "user",
      content,
      createdAt: now.toISOString(),
      replyToId: input.replyToId ?? null,
    },
    assistantMessage: {
      id: asstId,
      role: "assistant",
      content: assistantText.slice(0, 8000),
      createdAt: asstAt.toISOString(),
      replyToId: input.replyToId ?? null,
    },
    quota: { used: consume.count, limit: consume.limit, dayKey: consume.dayKey },
  };
}

export async function chatQuota(tenantId: string) {
  const limit = chatDailyLimit();
  const used = await getDailyCount(tenantId, "chat");
  return { used, limit, remaining: Math.max(0, limit - used) };
}

async function callChatLlm(input: {
  history: ChatMessageDto[];
  workspace: string;
  replySnippet: string | null;
}): Promise<string> {
  // Dynamic import keeps chat module light; uses same AgentRouter paths but short max tokens
  const { chatCompletionText } = await import("../integrations/llm-chat");
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: `${SYSTEM_CHAT}\n\nWorkspace snapshot:\n${input.workspace}`,
    },
  ];
  if (input.replySnippet) {
    messages.push({
      role: "system",
      content: `User is replying to this prior message:\n"""${input.replySnippet}"""`,
    });
  }
  for (const m of input.history) {
    if (m.role === "system") continue;
    messages.push({ role: m.role, content: m.content.slice(0, 1500) });
  }
  return chatCompletionText(messages);
}
