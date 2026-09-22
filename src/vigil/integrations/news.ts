import { z } from "zod";
import { VigilError } from "../security/errors";

export const newsItemSchema = z.object({
  headline: z.string().min(1),
  url: z.string().url().optional(),
  source: z.string().min(1),
  tickerHint: z.string().optional(),
  observedAt: z.string().datetime(),
  metricLabel: z.enum(["observed", "estimated", "targeted"]).default("observed"),
  raw: z.record(z.unknown()).default({}),
});

export type NewsItem = z.infer<typeof newsItemSchema>;

const WATCH_TICKERS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL"] as const;

export async function ingestClosedMarketNews(query?: string): Promise<NewsItem[]> {
  const q =
    query ??
    "US stock after-hours OR weekend macro OR earnings tokenized OR Bitget rToken NVDA OR TSLA OR AAPL";

  const tinyfishKey = process.env.TINYFISH_API_KEY?.trim();
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();

  if (tinyfishKey) {
    try {
      return await searchTinyFish(tinyfishKey, q);
    } catch (error) {
      if (!tavilyKey) throw error;
    }
  }

  if (tavilyKey) {
    return searchTavily(tavilyKey, q);
  }

  throw new VigilError(
    "NEWS_PROVIDER_UNAVAILABLE",
    "No news provider configured or all providers failed. Set TINYFISH_API_KEY or TAVILY_API_KEY.",
    503,
  );
}

async function searchTinyFish(apiKey: string, query: string): Promise<NewsItem[]> {
  const url = new URL("https://api.search.tinyfish.ai");
  url.searchParams.set("query", query);
  url.searchParams.set("domain_type", "news");
  url.searchParams.set("recency_minutes", String(60 * 48));

  const res = await fetch(url, {
    headers: { "X-API-Key": apiKey, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new VigilError(
      "NEWS_PROVIDER_UNAVAILABLE",
      `TinyFish Search failed with HTTP ${res.status}`,
      503,
      { body: await res.text() },
    );
  }
  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      snippet?: string;
      site_name?: string;
      date?: string;
    }>;
  };
  const results = data.results ?? [];
  if (!results.length) {
    throw new VigilError(
      "NEWS_PROVIDER_UNAVAILABLE",
      "TinyFish Search returned zero results for the closed-market query",
      503,
    );
  }
  return results.slice(0, 10).map((r) =>
    newsItemSchema.parse({
      headline: r.title ?? r.snippet ?? "Untitled",
      url: r.url,
      source: `tinyfish:${r.site_name ?? "web"}`,
      tickerHint: detectTicker(`${r.title ?? ""} ${r.snippet ?? ""}`),
      observedAt: new Date().toISOString(),
      metricLabel: "observed",
      raw: r as Record<string, unknown>,
    }),
  );
}

async function searchTavily(apiKey: string, query: string): Promise<NewsItem[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      topic: "news",
      max_results: 8,
    }),
  });
  if (!res.ok) {
    throw new VigilError(
      "NEWS_PROVIDER_UNAVAILABLE",
      `Tavily Search failed with HTTP ${res.status}`,
      503,
      { body: await res.text() },
    );
  }
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
  };
  const results = data.results ?? [];
  if (!results.length) {
    throw new VigilError("NEWS_PROVIDER_UNAVAILABLE", "Tavily returned zero results", 503);
  }
  return results.slice(0, 10).map((r) =>
    newsItemSchema.parse({
      headline: r.title ?? "Untitled",
      url: r.url,
      source: "tavily",
      tickerHint: detectTicker(`${r.title ?? ""} ${r.content ?? ""}`),
      observedAt: new Date().toISOString(),
      metricLabel: "observed",
      raw: r as Record<string, unknown>,
    }),
  );
}

function detectTicker(text: string): string | undefined {
  const upper = text.toUpperCase();
  return WATCH_TICKERS.find((t) => new RegExp(`\\b${t}\\b`).test(upper));
}
