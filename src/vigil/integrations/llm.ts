import { z } from "zod";
import { VigilError } from "../security/errors";

export const llmDecisionSchema = z.object({
  action: z.enum(["PAPER_BUY", "PAPER_SELL", "NO_TRADE", "WATCH"]),
  confidence: z.number().int().min(0).max(100),
  rationale: z.string().min(1).max(4000),
  metricLabel: z.enum(["observed", "estimated", "targeted"]).default("estimated"),
});

export type LlmDecision = z.infer<typeof llmDecisionSchema>;

export type LlmProvider =
  "relay" | "agentrouter" | "agentrouter-anthropic" | "venice" | "dashscope";

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
 * AgentRouter is often WAF-blocked from some cloud egress (Aliyun captcha HTML).
 * TinyFish Fetch to the same host returns HTTP 401 (API reachable from other egress) —
 * so production Cloudflare / laptop / VIGIL_LLM_RELAY_URL are valid workarounds.
 *
 * Order (override with VIGIL_LLM_ORDER comma list):
 *   relay → agentrouter → agentrouter-anthropic → venice → dashscope
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
    process.env.VIGIL_LLM_ORDER?.trim() ||
    "relay,agentrouter,agentrouter-anthropic,venice,dashscope"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const errors: string[] = [];

  for (const name of order) {
    try {
      if (name === "relay") {
        const relay = process.env.VIGIL_LLM_RELAY_URL?.trim();
        if (!relay) continue;
        return await callOpenAiCompatible({
          provider: "relay",
          path: relay,
          url: relay.replace(/\/$/, "") + "/chat/completions",
          apiKey:
            process.env.VIGIL_LLM_RELAY_KEY?.trim() ||
            process.env.AGENTROUTER_API_KEY?.trim() ||
            "relay",
          model: process.env.VIGIL_LLM_MODEL?.trim() || "gpt-4o-mini",
          system,
          user,
        });
      }

      if (name === "agentrouter") {
        const key = process.env.AGENTROUTER_API_KEY?.trim();
        if (!key) continue;
        return await callOpenAiCompatible({
          provider: "agentrouter",
          path: "openai-chat",
          url: `${(process.env.AGENTROUTER_BASE_URL?.trim() || "https://agentrouter.org/v1").replace(/\/$/, "")}/chat/completions`,
          apiKey: key,
          model: process.env.VIGIL_LLM_MODEL?.trim() || "gpt-4o-mini",
          system,
          user,
          ua: "claude-cli/1.0.0",
        });
      }

      if (name === "agentrouter-anthropic") {
        const key = process.env.AGENTROUTER_API_KEY?.trim();
        if (!key) continue;
        return await callAnthropicCompatible({
          provider: "agentrouter-anthropic",
          path: "anthropic-messages",
          url: `${(process.env.AGENTROUTER_ANTHROPIC_BASE?.trim() || "https://agentrouter.org").replace(/\/$/, "")}/v1/messages`,
          apiKey: key,
          model: process.env.VIGIL_LLM_MODEL?.trim() || "claude-sonnet-4-5-20250929",
          system,
          user,
        });
      }

      if (name === "venice") {
        const key = process.env.VENICE_API_KEY?.trim();
        if (!key) continue;
        return await callOpenAiCompatible({
          provider: "venice",
          path: "venice-chat",
          url: "https://api.venice.ai/api/v1/chat/completions",
          apiKey: key,
          model: process.env.VIGIL_LLM_MODEL?.trim() || "llama-3.3-70b",
          system,
          user,
        });
      }

      if (name === "dashscope") {
        // Alibaba Qwen OpenAI-compatible (optional Bitget Qwen credits / DashScope)
        const key = process.env.DASHSCOPE_API_KEY?.trim() || process.env.QWEN_API_KEY?.trim();
        if (!key) continue;
        return await callOpenAiCompatible({
          provider: "dashscope",
          path: "dashscope-compatible",
          url:
            process.env.DASHSCOPE_BASE_URL?.trim() ||
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
          apiKey: key,
          model: process.env.VIGIL_LLM_MODEL?.trim() || "qwen-plus",
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
    `All LLM paths failed or unset. Tried [${order.join(", ")}]. ${errors.join(" | ") || "No keys configured."} Tip: Cursor cloud VM may hit AgentRouter Aliyun WAF — use VENICE_API_KEY, DASHSCOPE_API_KEY, or VIGIL_LLM_RELAY_URL on clean egress (Lovable/CF deploy often works for AgentRouter).`,
    503,
    { errors },
  );
}

function looksLikeWaf(status: number, body: string, contentType: string | null): boolean {
  if (contentType?.includes("text/html")) return true;
  if (/aliyun_waf|aliyunCaptcha|滑动|captcha/i.test(body)) return true;
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
  ua?: string;
}): Promise<LlmCallResult> {
  const res = await fetch(args.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": args.ua || "VIGIL-Agent/1.0",
    },
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
}): Promise<LlmCallResult> {
  const res = await fetch(args.url, {
    method: "POST",
    headers: {
      "x-api-key": args.apiKey,
      Authorization: `Bearer ${args.apiKey}`,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "claude-cli/1.0.0",
    },
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
    throw new VigilError("VALIDATION_ERROR", "LLM did not return JSON decision", 502, { text });
  }
  return fenced[0];
}
