import { z } from "zod";
import { VigilError } from "../security/errors";

export const llmDecisionSchema = z.object({
  action: z.enum(["PAPER_BUY", "PAPER_SELL", "NO_TRADE", "WATCH"]),
  confidence: z.number().int().min(0).max(100),
  rationale: z.string().min(1).max(4000),
  metricLabel: z.enum(["observed", "estimated", "targeted"]).default("estimated"),
});

export type LlmDecision = z.infer<typeof llmDecisionSchema>;

export type LlmCallResult = {
  provider: "agentrouter" | "venice";
  model: string;
  decision: LlmDecision;
  rawText: string;
};

export async function scoreEventWithLlm(input: {
  headline: string;
  ticker: string;
  movePct: string;
  windowState: string;
  minConfidence: number;
}): Promise<LlmCallResult> {
  const model = process.env.VIGIL_LLM_MODEL?.trim() || "gpt-4o-mini";
  const system = `You are VIGIL, a closed-market paper-trading policy agent for Bitget rTokens.
Return ONLY compact JSON: {"action":"PAPER_BUY"|"PAPER_SELL"|"NO_TRADE"|"WATCH","confidence":0-100,"rationale":"...","metricLabel":"estimated"}.
Rules: paper only; no financial advice; require meaningful rToken move; if unsure use NO_TRADE or WATCH.`;

  const user = JSON.stringify({
    headline: input.headline,
    ticker: input.ticker,
    movePct: input.movePct,
    windowState: input.windowState,
    minConfidence: input.minConfidence,
  });

  const agentKey = process.env.AGENTROUTER_API_KEY?.trim();
  const veniceKey = process.env.VENICE_API_KEY?.trim();

  if (agentKey) {
    try {
      return await callOpenAiCompatible({
        provider: "agentrouter",
        baseUrl: "https://agentrouter.org/v1",
        apiKey: agentKey,
        model,
        system,
        user,
      });
    } catch (error) {
      if (!veniceKey) throw error;
    }
  }

  if (veniceKey) {
    return callOpenAiCompatible({
      provider: "venice",
      baseUrl: "https://api.venice.ai/api/v1",
      apiKey: veniceKey,
      model: process.env.VIGIL_LLM_MODEL?.trim() || "venice-uncensored",
      system,
      user,
    });
  }

  throw new VigilError(
    "LLM_NOT_CONFIGURED",
    "No LLM configured. Set AGENTROUTER_API_KEY or VENICE_API_KEY.",
    503,
  );
}

async function callOpenAiCompatible(args: {
  provider: "agentrouter" | "venice";
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<LlmCallResult> {
  const res = await fetch(`${args.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "VIGIL-Agent/1.0",
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

  if (!res.ok) {
    throw new VigilError(
      "LLM_NOT_CONFIGURED",
      `${args.provider} LLM call failed with HTTP ${res.status}`,
      503,
      { body: await res.text() },
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawText = data.choices?.[0]?.message?.content?.trim() ?? "";
  const jsonText = extractJson(rawText);
  const decision = llmDecisionSchema.parse(JSON.parse(jsonText));
  return { provider: args.provider, model: args.model, decision, rawText };
}

function extractJson(text: string): string {
  const fenced = text.match(/\{[\s\S]*\}/);
  if (!fenced) {
    throw new VigilError("VALIDATION_ERROR", "LLM did not return JSON decision", 502, { text });
  }
  return fenced[0];
}
