/**
 * Trader entry rubric — discipline / bias / news (Investopedia-aligned).
 * Sources (fact-checked 2026-09-22):
 * - https://www.investopedia.com/terms/c/confirmation-bias.asp
 * - https://www.investopedia.com/trading-psychology-4689647
 * - https://www.investopedia.com/terms/a/afterhourstrading.asp
 * - https://www.investopedia.com/terms/s/slippage.asp
 * - https://www.investopedia.com/articles/trading/06/daytradingretail.asp
 * Used by LLM policy + sealed why-card analysis. Not financial advice.
 */

export type EntryAnalysis = {
  thesis: string;
  bullCase: string[];
  bearCase: string[];
  invalidation: string[];
  biasChecks: string[];
  sessionRisk: string;
  sizeRule: string;
  metricLabel: "observed" | "estimated" | "targeted";
};

export const TRADER_RUBRIC_SYSTEM = `You are VIGIL — a FENN-disciplined closed-market paper co-pilot (Bitget Demo only).
Return ONLY compact JSON with this shape:
{
  "action":"PAPER_BUY"|"PAPER_SELL"|"NO_TRADE"|"WATCH",
  "confidence":0-100,
  "rationale":"short sealed summary",
  "metricLabel":"estimated",
  "analysis":{
    "thesis":"one sentence named setup + catalyst",
    "bullCase":["supporting fact 1","supporting fact 2"],
    "bearCase":["disconfirming fact 1","disconfirming fact 2"],
    "invalidation":["exact price/news condition that kills the idea"],
    "biasChecks":["confirmation-bias: sought opposing evidence","FOMO/revenge/sunk-cost check"],
    "sessionRisk":"after-hours liquidity / spread / gap / slippage note",
    "sizeRule":"fixed paper size only — never spray balance"
  }
}

Discipline (must follow — perfect-trader checklist):
1. Refuse by default if allowlisted=false.
2. Require BOTH a plausible news catalyst AND meaningful observed move (~≥1% abs) for PAPER_*.
3. Always write bullCase AND bearCase (Investopedia confirmation-bias: seek disconfirming evidence). If you cannot name 2 bear points → NO_TRADE.
4. Always write invalidation BEFORE endorsing PAPER_* (pre-commit exit; day-trading discipline).
5. After-hours: thinner liquidity, wider spreads, slippage risk — prefer WATCH/NO_TRADE when move is noisy or headline is rumor-only.
6. Direction: positive move + constructive catalyst → PAPER_BUY; negative + adverse catalyst → PAPER_SELL; conflict → NO_TRADE/WATCH.
7. Bias circuit-breaker: call out FOMO, revenge trading, and sunk-cost fallacy (trading psychology). If emotional chase → WATCH/NO_TRADE.
8. confidence ≥ minConfidence only when analysis is complete; else lower confidence + WATCH/NO_TRADE.
9. If memoryPriors show repeated losses / lesson-guard on this ticker+setup → prefer WATCH/NO_TRADE unless fresh disconfirming evidence.
10. Never invent fills, prices, or UIDs. Paper-only. Not financial advice.`;

export function buildTraderUserPayload(input: {
  headline: string;
  ticker: string;
  movePct: string;
  windowState: string;
  minConfidence: number;
  allowlisted: boolean;
  memoryPriors?: string[];
}): string {
  return JSON.stringify({
    ...input,
    memoryPriors: (input.memoryPriors ?? []).slice(0, 6),
    rubric: [
      "named setup + catalyst",
      "bull vs bear (disconfirming evidence)",
      "invalidation pre-committed",
      "session/liquidity/slippage risk labeled",
      "fixed size — FENN one-side",
      "bias circuit-breaker (FOMO/revenge/sunk-cost)",
      "respect memoryPriors — do not repeat losing setups without new evidence",
    ],
    references: [
      "Investopedia confirmation-bias — do not cherry-pick headlines",
      "Investopedia trading-psychology — pre-commit plan; avoid sunk-cost",
      "Investopedia after-hours — low liquidity, wide spreads, volatile news",
      "Investopedia slippage — worse after-hours + market orders",
    ],
  });
}

export function parseEntryAnalysis(raw: unknown): EntryAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const asList = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 6) : [];
  const thesisRaw = a["thesis"];
  const thesis = typeof thesisRaw === "string" ? thesisRaw.trim() : "";
  if (!thesis) return null;
  const metric = a["metricLabel"];
  const sessionRisk = a["sessionRisk"];
  const sizeRule = a["sizeRule"];
  return {
    thesis,
    bullCase: asList(a["bullCase"]),
    bearCase: asList(a["bearCase"]),
    invalidation: asList(a["invalidation"]),
    biasChecks: asList(a["biasChecks"]),
    sessionRisk: typeof sessionRisk === "string" ? sessionRisk : "unspecified",
    sizeRule:
      typeof sizeRule === "string" ? sizeRule : "fixed paper size — never spray balance",
    metricLabel: metric === "observed" || metric === "targeted" ? metric : "estimated",
  };
}

/** Gate: PAPER_* requires complete anti-bias analysis. */
export function analysisCompleteForPaper(a: EntryAnalysis | null | undefined): boolean {
  if (!a) return false;
  return (
    a.thesis.length > 0 &&
    a.bullCase.length >= 1 &&
    a.bearCase.length >= 2 &&
    a.invalidation.length >= 1 &&
    a.biasChecks.length >= 1
  );
}
