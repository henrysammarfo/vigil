import type { NewsItem } from "../integrations/news";

export type SignalAssessment = {
  ticker: string;
  movePct: string;
  score: number;
  state: "Qualified" | "Review" | "Watch" | "Rejected";
  metricLabel: "observed" | "estimated";
  details: Record<string, unknown>;
};

/**
 * rToken movement check.
 * Uses Bitget public ticker when available; otherwise marks metric as estimated from headline heuristics
 * ONLY when an observed public quote path fails — and never invents a fill.
 * Prefer live Bitget public market data.
 */
export async function assessRtokenSignal(item: NewsItem): Promise<SignalAssessment> {
  const ticker = (item.tickerHint ?? inferTicker(item.headline) ?? "NVDA").toUpperCase();
  const live = await fetchBitgetTickerMove(ticker);

  if (live) {
    const score = scoreFromMove(live.movePct, item.headline);
    return {
      ticker,
      movePct: formatMove(live.movePct),
      score,
      state: stateFromScore(score),
      metricLabel: "observed",
      details: { quote: live.raw, source: "bitget-public-ticker" },
    };
  }

  // Without a public quote we cannot claim observed movement — reject for paper execution.
  return {
    ticker,
    movePct: "0.00%",
    score: 0,
    state: "Rejected",
    metricLabel: "observed",
    details: {
      reason: "No live Bitget public ticker available; refusing to invent movement",
      headline: item.headline,
    },
  };
}

async function fetchBitgetTickerMove(
  ticker: string,
): Promise<{ movePct: number; raw: Record<string, unknown> } | null> {
  const symbol = `${ticker}USDT`;
  const base = process.env.BITGET_BASE_URL?.trim() || "https://api.bitget.com";
  try {
    const url = `${base}/api/v2/mix/market/ticker?productType=USDT-FUTURES&symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, { headers: { Accept: "application/json", locale: "en-US" } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Record<string, unknown> | Array<Record<string, unknown>>;
    };
    const data = Array.isArray(json.data) ? json.data[0] : json.data;
    if (!data) return null;
    const change = Number(
      data.change24h ?? data.changeUtc ?? data.priceChangePercent ?? data.chgUtc ?? 0,
    );
    if (!Number.isFinite(change)) return null;
    // Bitget may return fraction or percent; normalize to percent points.
    const movePct = Math.abs(change) <= 1 ? change * 100 : change;
    return { movePct, raw: data };
  } catch {
    return null;
  }
}

function scoreFromMove(movePct: number, headline: string): number {
  const magnitude = Math.min(100, Math.round(Math.abs(movePct) * 20));
  const keywordBoost = /export|earnings|guidance|fed|rate|inflation|geopolitic|sanction/i.test(
    headline,
  )
    ? 15
    : 0;
  return Math.max(0, Math.min(100, magnitude + keywordBoost));
}

function stateFromScore(score: number): SignalAssessment["state"] {
  if (score >= 80) return "Qualified";
  if (score >= 60) return "Review";
  if (score >= 40) return "Watch";
  return "Rejected";
}

function formatMove(movePct: number): string {
  const sign = movePct > 0 ? "+" : "";
  return `${sign}${movePct.toFixed(2)}%`;
}

function inferTicker(headline: string): string | undefined {
  const m = headline.toUpperCase().match(/\b(NVDA|TSLA|AAPL|MSFT|AMZN|META|GOOGL)\b/);
  return m?.[1];
}
