/**
 * Bitget USDT-FUTURES public candles (observed).
 * GET /api/v2/mix/market/history-candles · /candles
 */

export type Candle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  metricLabel: "observed";
};

export type CandleGranularity =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1H"
  | "4H"
  | "1D";

function baseUrl(): string {
  return process.env["BITGET_BASE_URL"]?.trim() || "https://api.bitget.com";
}

function parseRow(row: unknown): Candle | null {
  if (!Array.isArray(row) || row.length < 5) return null;
  const ts = Number(row[0]);
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low = Number(row[3]);
  const close = Number(row[4]);
  const volume = Number(row[5] ?? 0);
  const quoteVolume = Number(row[6] ?? 0);
  if (![ts, open, high, low, close].every((n) => Number.isFinite(n) && n > 0)) return null;
  return {
    ts,
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) ? volume : 0,
    quoteVolume: Number.isFinite(quoteVolume) ? quoteVolume : 0,
    metricLabel: "observed",
  };
}

async function fetchCandlePage(input: {
  path: "/api/v2/mix/market/history-candles" | "/api/v2/mix/market/candles";
  symbol: string;
  granularity: CandleGranularity;
  limit?: number;
  startTime?: number;
  endTime?: number;
}): Promise<Candle[]> {
  const symbol = input.symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const params = new URLSearchParams({
    symbol,
    productType: "USDT-FUTURES",
    granularity: input.granularity,
    limit: String(Math.min(200, Math.max(1, input.limit ?? 100))),
  });
  if (input.startTime != null) params.set("startTime", String(input.startTime));
  if (input.endTime != null) params.set("endTime", String(input.endTime));
  const url = `${baseUrl()}${input.path}?${params}`;
  const res = await fetch(url, { headers: { Accept: "application/json", locale: "en-US" } });
  if (!res.ok) return [];
  const json = (await res.json()) as { code?: string; data?: unknown[] };
  if (json.code && json.code !== "00000") return [];
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows.map(parseRow).filter((c): c is Candle => Boolean(c));
}

/** Recent candles (includes forming bar on /candles). */
export async function fetchBitgetCandles(input: {
  symbol: string;
  granularity?: CandleGranularity;
  limit?: number;
}): Promise<Candle[]> {
  const rows = await fetchCandlePage({
    path: "/api/v2/mix/market/candles",
    symbol: input.symbol,
    granularity: input.granularity ?? "15m",
    limit: input.limit ?? 100,
  });
  return rows.sort((a, b) => a.ts - b.ts);
}

/**
 * Paginate history-candles backward until lookbackBars reached or exhausted.
 * Max ~200 per page; public, no auth.
 */
export async function fetchBitgetHistoryCandles(input: {
  symbol: string;
  granularity?: CandleGranularity;
  lookbackBars?: number;
  endTime?: number;
}): Promise<Candle[]> {
  const granularity = input.granularity ?? "1H";
  const want = Math.min(2000, Math.max(50, input.lookbackBars ?? 240));
  let endTime = input.endTime ?? Date.now();
  const byTs = new Map<number, Candle>();
  let guard = 0;
  while (byTs.size < want && guard < 25) {
    guard += 1;
    const page = await fetchCandlePage({
      path: "/api/v2/mix/market/history-candles",
      symbol: input.symbol,
      granularity,
      limit: 200,
      endTime,
    });
    if (!page.length) break;
    for (const c of page) byTs.set(c.ts, c);
    const oldest = Math.min(...page.map((c) => c.ts));
    if (oldest >= endTime) break;
    endTime = oldest - 1;
  }
  return [...byTs.values()].sort((a, b) => a.ts - b.ts).slice(-want);
}
