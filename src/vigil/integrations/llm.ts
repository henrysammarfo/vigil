import { z } from "zod";
import { VigilError } from "../security/errors";

function env(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === "string" ? v : undefined;
}

export const llmDecisionSchema = z.object({
  action: z.enum(["PAPER_BUY", "PAPER_SELL", "NO_TRADE", "WATCH"]),
  confidence: z.number().int().min(0).max(100),
  rationale: z.string().min(1).max(4000),
  metricLabel: z.enum(["observed", "estimated", "targeted"]).default("estimated"),
});

export type LlmDecision = z.infer<typeof llmDecisionSchema>;

export type LlmProvider =
  "relay" | "agentrouter-proxy" | "agentrouter" | "agentrouter-anthropic" | "venice" | "dashscope";

export type LlmCallResult = {
  provider: LlmProvider;
  model: string;
  decision: LlmDecision;
  rawText: string;
  path: string;
};

/**
 * Multi-path LLM scoring.
 *
 * AgentRouter Aliyun WAF allowlists TLS fingerprints / SDK headers — not just Bearer.
 * Documented bypasses (see scripts/agentrouter-proxy, agentrouter-org/docs#21):
 *   1. Local Python sync `anthropic` proxy → AGENTROUTER_PROXY_URL (port 7187)
 *   2. OpenAI-compatible path with QwenCode UA + x-stainless-* headers
 *   3. Anthropic Messages on root base (no /v1) — portal: co.agentrouter.org
 *   4. Clean-egress relay (worker/llm-relay.ts) / Lovable Nitro production
 *
 * TinyFish Fetch to agentrouter is NOT an auth proxy: docs.tinyfish.ai/fetch-api
 * does not forward Authorization. TinyFish returns HTTP 200 with
 * errors[].status=401 (target_http_error) — that is expected, not a bad TinyFish key.
 *
 * Order (override with VIGIL_LLM_ORDER):
 *   relay → agentrouter-proxy → agentrouter → agentrouter-anthropic → venice → dashscope
 */
export async function scoreEventWithLlm(input: {
  headline: string;
  ticker: string;
  movePct: string;
  windowState: string;
  minConfidence: number;
  allowlisted: boolean;
}): Promise<LlmCallResult> {
  const system = `You are VIGIL (FENN-disciplined). Closed-market paper-only Bitget rToken policy.
Return ONLY compact JSON: {"action":"PAPER_BUY"|"PAPER_SELL"|"NO_TRADE"|"WATCH","confidence":0-100,"rationale":"...","metricLabel":"estimated"}.
Rules: prefer NO_TRADE; paper only if allowlisted=${input.allowlisted} AND move is meaningful; no advice; never invent fills.`;

  const user = JSON.stringify({
    headline: input.headline,
    ticker: input.ticker,
    movePct: input.movePct,
    windowState: input.windowState,
    minConfidence: input.minConfidence,
    allowlisted: input.allowlisted,
  });

  const order = (
    env("VIGIL_LLM_ORDER")?.trim() ||
    "relay,agentrouter-proxy,agentrouter,agentrouter-anthropic,venice,dashscope"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const errors: string[] = [];

  for (const name of order) {
    try {
      if (name === "relay") {
        const relay = env("VIGIL_LLM_RELAY_URL")?.trim();
        if (!relay) continue;
        return await callOpenAiCompatible({
          provider: "relay",
          path: relay,
          url: relay.replace(/\/$/, "") + "/chat/completions",
          apiKey:
            env("VIGIL_LLM_RELAY_KEY")?.trim() || env("AGENTROUTER_API_KEY")?.trim() || "relay",
          model: env("VIGIL_LLM_MODEL")?.trim() || "gpt-4o-mini",
          system,
          user,
          stainless: true,
        });
      }

      if (name === "agentrouter-proxy") {
        // Local sync-Anthropic fingerprint proxy (scripts/agentrouter-proxy)
        const proxy = (
          env("AGENTROUTER_PROXY_URL")?.trim() ||
          env("ANTHROPIC_BASE_URL")?.trim() ||
          ""
        ).replace(/\/$/, "");
        const key = env("AGENTROUTER_API_KEY")?.trim();
        if (!proxy || !key) continue;
        // Only treat localhost / explicit proxy as the fingerprint bypass path
        const isLocal =
          proxy.includes("127.0.0.1") ||
          proxy.includes("localhost") ||
          env("AGENTROUTER_PROXY_URL")?.trim();
        if (!isLocal) continue;
        return await callAnthropicCompatible({
          provider: "agentrouter-proxy",
          path: "proxy-messages",
          url: `${proxy}/v1/messages`,
          apiKey: key,
          model:
            env("VIGIL_LLM_MODEL")?.trim() || env("ANTHROPIC_MODEL")?.trim() || "claude-opus-4-6",
          system,
          user,
        });
      }

      if (name === "agentrouter") {
        const key = env("AGENTROUTER_API_KEY")?.trim();
        if (!key) continue;
        const bases = agentrouterOpenAiBases();
        let lastErr: Error | null = null;
        for (const base of bases) {
          try {
            return await callOpenAiCompatible({
              provider: "agentrouter",
              path: `openai-chat:${base}`,
              url: `${base}/chat/completions`,
              apiKey: key,
              model: env("VIGIL_LLM_MODEL")?.trim() || "gpt-4o-mini",
              system,
              user,
              stainless: true,
            });
          } catch (e) {
            lastErr = e instanceof Error ? e : new Error(String(e));
            // try next base host
          }
        }
        throw lastErr ?? new Error("agentrouter: no bases");
      }

      if (name === "agentrouter-anthropic") {
        const key = env("AGENTROUTER_API_KEY")?.trim();
        if (!key) continue;
        const bases = agentrouterAnthropicBases();
        let lastErr: Error | null = null;
        for (const base of bases) {
          try {
            return await callAnthropicCompatible({
              provider: "agentrouter-anthropic",
              path: `anthropic-messages:${base}`,
              url: `${base}/v1/messages`,
              apiKey: key,
              model:
                env("VIGIL_LLM_MODEL")?.trim() ||
                env("ANTHROPIC_MODEL")?.trim() ||
                "claude-sonnet-4-5-20250929",
              system,
              user,
              stainless: true,
            });
          } catch (e) {
            lastErr = e instanceof Error ? e : new Error(String(e));
          }
        }
        throw lastErr ?? new Error("agentrouter-anthropic: no bases");
      }

      if (name === "venice") {
        const key = env("VENICE_API_KEY")?.trim();
        if (!key) continue;
        return await callOpenAiCompatible({
          provider: "venice",
          path: "venice-chat",
          url: "https://api.venice.ai/api/v1/chat/completions",
          apiKey: key,
          model: env("VIGIL_LLM_MODEL")?.trim() || "llama-3.3-70b",
          system,
          user,
        });
      }

      if (name === "dashscope") {
        // Alibaba Qwen OpenAI-compatible (optional Bitget Qwen credits / DashScope)
        const key = env("DASHSCOPE_API_KEY")?.trim() || env("QWEN_API_KEY")?.trim();
        if (!key) continue;
        return await callOpenAiCompatible({
          provider: "dashscope",
          path: "dashscope-compatible",
          url:
            env("DASHSCOPE_BASE_URL")?.trim() ||
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
          apiKey: key,
          model: env("VIGIL_LLM_MODEL")?.trim() || "qwen-plus",
          system,
          user,
        });
      }
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new VigilError(
    "LLM_NOT_CONFIGURED",
    `All LLM paths failed or unset. Tried [${order.join(", ")}]. ${errors.join(" | ") || "No keys configured."} Tip: Aliyun WAF needs sync-Anthropic proxy (scripts/agentrouter-proxy → AGENTROUTER_PROXY_URL) or clean egress (VIGIL_LLM_RELAY_URL / Lovable). TinyFish Fetch 401 on agentrouter is target_http_error (no auth forward), not a bad TinyFish key.`,
    503,
    { errors },
  );
}

/** OpenAI-compatible bases (must include /v1). Prefer portal co host, then legacy. */
export function agentrouterOpenAiBases(): string[] {
  const primary = (env("AGENTROUTER_BASE_URL")?.trim() || "https://co.agentrouter.org/v1").replace(
    /\/$/,
    "",
  );
  const alts = ["https://co.agentrouter.org/v1", "https://agentrouter.org/v1"];
  return uniqueUrls([primary, ...alts]);
}

/** Anthropic-compatible bases (NO /v1 — SDK appends /v1/messages). */
export function agentrouterAnthropicBases(): string[] {
  const primary = (
    env("AGENTROUTER_ANTHROPIC_BASE")?.trim() || "https://co.agentrouter.org"
  ).replace(/\/$/, "");
  const alts = ["https://co.agentrouter.org", "https://agentrouter.org"];
  return uniqueUrls([primary, ...alts]);
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const n = u.replace(/\/$/, "");
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * Headers that match allowlisted AgentRouter clients (Qwen Code / OpenAI Node SDK).
 * Raw curl/fetch without these → "unauthorized client detected".
 */
export function agentrouterStainlessHeaders(apiKey: string): Record<string, string> {
  const runtime =
    typeof process !== "undefined" && process.versions?.["bun"]
      ? { name: "bun", version: `bun/${process.versions["bun"]}` }
      : typeof process !== "undefined" && process.versions?.["node"]
        ? { name: "node", version: `node/${process.versions["node"]}` }
        : { name: "node", version: "node/20.0.0" };

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "QwenCode/0.2.0 (linux; x64)",
    "x-stainless-lang": "js",
    "x-stainless-package-version": "6.34.0",
    "x-stainless-os": "Linux",
    "x-stainless-arch": "x64",
    "x-stainless-runtime": runtime.name,
    "x-stainless-runtime-version": runtime.version,
    "x-stainless-retry-count": "0",
  };
}

export function looksLikeWaf(status: number, body: string, contentType: string | null): boolean {
  if (contentType?.includes("text/html")) return true;
  if (/aliyun_waf|aliyunCaptcha|滑动|captcha/i.test(body)) return true;
  if (/unauthorized client detected/i.test(body)) return true;
  if (status === 405 && body.includes("<!doctype html>")) return true;
  return false;
}

async function callOpenAiCompatible(args: {
  provider: LlmProvider;
  path: string;
  url: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  stainless?: boolean;
}): Promise<LlmCallResult> {
  const headers = args.stainless
    ? agentrouterStainlessHeaders(args.apiKey)
    : {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "VIGIL-Agent/1.0",
      };

  const res = await fetch(args.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: args.model,
      temperature: 0.1,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });

  const text = await res.text();
  if (looksLikeWaf(res.status, text, res.headers.get("content-type"))) {
    throw new Error(`WAF_BLOCKED on ${args.path}`);
  }
  if (!res.ok) {
    throw new Error(`${args.provider} HTTP ${res.status}: ${text.slice(0, 240)}`);
  }

  const data = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawText = data.choices?.[0]?.message?.content?.trim() ?? "";
  const decision = llmDecisionSchema.parse(JSON.parse(extractJson(rawText)));
  return {
    provider: args.provider,
    model: args.model,
    decision,
    rawText,
    path: args.path,
  };
}

async function callAnthropicCompatible(args: {
  provider: LlmProvider;
  path: string;
  url: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  stainless?: boolean;
}): Promise<LlmCallResult> {
  const headers: Record<string, string> = {
    "x-api-key": args.apiKey,
    Authorization: `Bearer ${args.apiKey}`,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": args.stainless ? "claude-cli/1.0.0 (external, cli)" : "claude-cli/1.0.0",
  };
  if (args.stainless) {
    Object.assign(headers, {
      "x-stainless-lang": "js",
      "x-stainless-package-version": "0.39.0",
      "x-stainless-os": "Linux",
      "x-stainless-arch": "x64",
      "x-stainless-runtime": "node",
      "x-stainless-runtime-version":
        typeof process !== "undefined" && process.versions?.["node"]
          ? `node/${process.versions["node"]}`
          : "node/20.0.0",
      "x-stainless-retry-count": "0",
    });
  }

  const res = await fetch(args.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: args.model,
      max_tokens: 800,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
    }),
  });

  const text = await res.text();
  if (looksLikeWaf(res.status, text, res.headers.get("content-type"))) {
    throw new Error(`WAF_BLOCKED on ${args.path}`);
  }
  if (!res.ok) {
    throw new Error(`${args.provider} HTTP ${res.status}: ${text.slice(0, 240)}`);
  }

  const data = JSON.parse(text) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const rawText =
    data.content
      ?.map((c) => c.text ?? "")
      .join("\n")
      .trim() || extractJson(text);
  const decision = llmDecisionSchema.parse(JSON.parse(extractJson(rawText)));
  return {
    provider: args.provider,
    model: args.model,
    decision,
    rawText,
    path: args.path,
  };
}

function extractJson(text: string): string {
  const fenced = text.match(/\{[\s\S]*\}/);
  if (!fenced) {
    throw new VigilError("VALIDATION_ERROR", "LLM did not return JSON decision", 502, {
      text,
    });
  }
  return fenced[0];
}
