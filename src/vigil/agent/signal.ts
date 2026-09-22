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
    const score = scoreFromMove(live.movePct, item.headline, live.rangePct);
    return {
      ticker,
      movePct: formatMove(live.movePct),
      score,
      state: stateFromScore(score),
      metricLabel: "observed",
      details: {
        quote: live.raw,
        source: "bitget-public-ticker",
        rangePct: live.rangePct,
        change24hPct: live.movePct,
      },
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
): Promise<{ movePct: number; rangePct: number; raw: Record<string, unknown> } | null> {
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

    const changeCandidates = [
      data.change24h,
      data.changeUtc24h,
      data.changeUtc,
      data.priceChangePercent,
      data.chgUtc,
    ].map((v) => Number(v));
    const finite = changeCandidates.filter((n) => Number.isFinite(n));
    if (!finite.length) return null;

    // Bitget returns fractions (0.021 = 2.1%) or percent; normalize to percent points.
    const asPct = (n: number) => (Math.abs(n) <= 1 ? n * 100 : n);
    const movePct = finite.map(asPct).sort((a, b) => Math.abs(b) - Math.abs(a))[0]!;

    const high = Number(data.high24h);
    const low = Number(data.low24h);
    const open = Number(data.open24h ?? data.openUtc ?? data.lastPr);
    let rangePct = 0;
    if (Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(open) && open > 0) {
      rangePct = ((high - low) / open) * 100;
    }

    return { movePct, rangePct, raw: data };
  } catch {
    return null;
  }
}

/** Exported for unit tests — maps observed move + headline catalyst → 0–100 score. */
export function scoreFromMove(movePct: number, headline: string, rangePct = 0): number {
  // Mega-cap overnight: ~1.3% → Watch, ~2% → Review territory, ~2.7% → Qualified.
  const magnitude = Math.min(100, Math.round(Math.abs(movePct) * 30));
  const rangeBoost = Math.min(20, Math.round(Math.abs(rangePct) * 4));
  const keywordBoost = CATALYST_RE.test(headline) ? 18 : 0;
  const namedBoost = /\b(NVDA|TSLA|AAPL|MSFT|AMZN|META|GOOGL|Nvidia|Tesla|Apple)\b/i.test(
    headline,
  )
    ? 8
    : 0;
  return Math.max(0, Math.min(100, magnitude + Math.max(rangeBoost, keywordBoost) + namedBoost));
}

const CATALYST_RE =
  /export|earnings|guidance|fed|rate|inflation|geopolitic|sanction|upgrade|downgrade|lawsuit|recall|chip|ai |gpu|autonom|delivery|revenue|beat|miss|outlook|buyback|split|sec |probe|ban|tariff|war|ceasefire|ipo|acquisition|merger/i;

export function stateFromScore(score: number): SignalAssessment["state"] {
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
