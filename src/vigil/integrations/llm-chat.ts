/**
 * Short chat completions for VIGIL Desk — reuses AgentRouter failover.
 * Never returns API keys. Hard max_tokens to protect free-tier quota.
 */
import { VigilError } from "../security/errors";
import {
  agentrouterModels,
  agentrouterOpenAiBases,
  agentrouterStainlessHeaders,
  looksLikeWaf,
  shouldUseTor,
  torSocksUrl,
} from "./llm";
import https from "node:https";
import http from "node:http";
import { SocksProxyAgent } from "socks-proxy-agent";

export type ChatRoleMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === "string" ? v : undefined;
}

/** Cap reply length — desk answers stay short; protects API spend. */
const CHAT_MAX_TOKENS = 450;
const CHAT_TEMPERATURE = 0.3;

export async function chatCompletionText(messages: ChatRoleMessage[]): Promise<string> {
  if (!messages.length) {
    throw new VigilError("VALIDATION_ERROR", "No chat messages", 400);
  }

  const order = (
    env("VIGIL_LLM_ORDER")?.trim() ||
    "relay,agentrouter-proxy,agentrouter,agentrouter-anthropic,venice,dashscope"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const errors: string[] = [];
  const models = agentrouterModels();
  const model = env("VIGIL_LLM_MODEL")?.trim() || models[0]!;

  for (const name of order) {
    try {
      if (name === "relay") {
        const relay = env("VIGIL_LLM_RELAY_URL")?.trim();
        if (!relay) continue;
        return await openAiChat({
          url: relay.replace(/\/$/, "") + "/chat/completions",
          apiKey:
            env("VIGIL_LLM_RELAY_KEY")?.trim() || env("AGENTROUTER_API_KEY")?.trim() || "relay",
          model,
          messages,
          stainless: true,
        });
      }

      if (name === "agentrouter") {
        const key = env("AGENTROUTER_API_KEY")?.trim();
        if (!key) continue;
        const viaTor = shouldUseTor();
        for (const base of agentrouterOpenAiBases()) {
          try {
            return await openAiChat({
              url: `${base}/chat/completions`,
              apiKey: key,
              model,
              messages,
              stainless: true,
              viaTor,
            });
          } catch (e) {
            errors.push(
              `agentrouter ${base}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
        continue;
      }

      if (name === "venice") {
        const key = env("VENICE_API_KEY")?.trim();
        if (!key) continue;
        return await openAiChat({
          url:
            (env("VENICE_BASE_URL")?.trim() || "https://api.venice.ai/api/v1").replace(
              /\/$/,
              "",
            ) + "/chat/completions",
          apiKey: key,
          model: env("VENICE_MODEL")?.trim() || "llama-3.3-70b",
          messages,
        });
      }

      if (name === "dashscope") {
        const key = env("DASHSCOPE_API_KEY")?.trim() || env("QWEN_API_KEY")?.trim();
        if (!key) continue;
        return await openAiChat({
          url:
            env("DASHSCOPE_BASE_URL")?.trim() ||
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
          apiKey: key,
          model: env("VIGIL_LLM_MODEL")?.trim() || "qwen-plus",
          messages,
        });
      }
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new VigilError(
    "LLM_NOT_CONFIGURED",
    `Chat LLM paths failed. ${errors.join(" | ") || "No keys configured."}`,
    503,
    { errors },
  );
}

async function openAiChat(args: {
  url: string;
  apiKey: string;
  model: string;
  messages: ChatRoleMessage[];
  stainless?: boolean;
  viaTor?: boolean;
}): Promise<string> {
  const headers = args.stainless
    ? agentrouterStainlessHeaders(args.apiKey)
    : {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "VIGIL-Desk/1.0",
      };

  const res = await vigilFetch(args.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: args.model,
      temperature: CHAT_TEMPERATURE,
      max_tokens: CHAT_MAX_TOKENS,
      messages: args.messages.map((m) => ({
        role: m.role,
        content: m.content.slice(0, 4000),
      })),
    }),
    ...(args.viaTor ? { viaTor: true as const } : {}),
  });

  const text = await res.text();
  if (looksLikeWaf(res.status, text, res.headers.get("content-type"))) {
    throw new Error(`WAF_BLOCKED on chat`);
  }
  if (!res.ok) {
    throw new Error(`chat HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("Empty chat completion");
  return content;
}

async function vigilFetch(
  url: string,
  init: RequestInit & { viaTor?: boolean },
): Promise<Response> {
  const { viaTor, ...rest } = init;
  if (!viaTor) return fetch(url, rest);
  return torHttpsFetch(url, rest);
}

function torHttpsFetch(url: string, init: RequestInit): Promise<Response> {
  const agent = new SocksProxyAgent(torSocksUrl());
  const u = new URL(url);
  const lib = u.protocol === "http:" ? http : https;
  const headers: Record<string, string> = {};
  const raw = init.headers;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, string>)) {
      if (v !== undefined) headers[k] = String(v);
    }
  }
  const body =
    typeof init.body === "string" ? init.body : init.body != null ? String(init.body) : undefined;
  if (body && !headers["Content-Length"] && !headers["content-length"]) {
    headers["Content-Length"] = Buffer.byteLength(body).toString();
  }

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "http:" ? 80 : 443),
        path: `${u.pathname}${u.search}`,
        method: init.method || "GET",
        headers,
        agent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const outHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") outHeaders[k] = v;
            else if (Array.isArray(v)) outHeaders[k] = v.join(", ");
          }
          resolve(
            new Response(text, {
              status: res.statusCode || 0,
              statusText: res.statusMessage || "",
              headers: outHeaders,
            }),
          );
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}
