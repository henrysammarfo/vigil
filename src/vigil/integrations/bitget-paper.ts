import { createHmac, randomBytes } from "node:crypto";
import { VigilError } from "../security/errors";

export type PaperOrderRequest = {
  symbol: string;
  side: "buy" | "sell";
  size: string;
  orderType?: "market" | "limit";
  price?: string;
  /** Hedge-mode position side; defaults from buy→long / sell→short */
  posSide?: "long" | "short";
  category?: "USDT-FUTURES" | "SPOT" | "MARGIN" | "USDC-FUTURES" | "COIN-FUTURES";
};

export type PaperOrderResult = {
  status: string;
  exchangeOrderId: string | null;
  raw: Record<string, unknown>;
  metricLabel: "observed";
};

export type BitgetMarkQuote = {
  symbol: string;
  last: number;
  mark: number;
  raw: Record<string, unknown>;
  metricLabel: "observed";
};

function requirePaperConfig(): {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  baseUrl: string;
} {
  const paper = process.env["BITGET_PAPER"]?.trim().toLowerCase();
  if (paper !== "true" && paper !== "1" && paper !== "yes") {
    throw new VigilError(
      "PAPER_LOCK_VIOLATION",
      "BITGET_PAPER must be true. Live execution is forbidden for VIGIL S2.",
      403,
    );
  }
  const apiKey = process.env["BITGET_API_KEY"]?.trim();
  const apiSecret = process.env["BITGET_API_SECRET"]?.trim();
  const passphrase = process.env["BITGET_PASSPHRASE"]?.trim();
  if (!apiKey || !apiSecret || !passphrase) {
    throw new VigilError(
      "BITGET_PAPER_NOT_CONFIGURED",
      "Bitget Demo API credentials missing. Set BITGET_API_KEY, BITGET_API_SECRET, BITGET_PASSPHRASE with a Demo key.",
      503,
    );
  }
  return {
    apiKey,
    apiSecret,
    passphrase,
    baseUrl: process.env["BITGET_BASE_URL"]?.trim() || "https://api.bitget.com",
  };
}

function sign(secret: string, prehash: string): string {
  return createHmac("sha256", secret).update(prehash).digest("base64");
}

/**
 * Normalize ticker for Demo USDT-FUTURES stock pairs (AAPLUSDT, NVDAUSDT, …).
 * Reality spot rTokens (RNVDUSDT) use BITGET_SYMBOL_MODE=reality.
 */
export function toBitgetPaperSymbol(raw: string): string {
  let s = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!s) return s;
  const mode = (process.env["BITGET_SYMBOL_MODE"]?.trim().toLowerCase() || "futures") as string;
  if (mode === "reality") {
    if (!s.endsWith("USDT")) s = `${s}USDT`;
    if (s.startsWith("R")) return s;
    return `R${s}`;
  }
  if (s.startsWith("R") && s.length > 1) s = s.slice(1);
  if (!s.endsWith("USDT")) s = `${s}USDT`;
  return s;
}

/** @deprecated alias — prefer toBitgetPaperSymbol */
export const toBitgetRtokenSymbol = toBitgetPaperSymbol;

/** Public mark/last for USDT-FUTURES (no auth). */
export async function fetchBitgetMarkQuote(symbolRaw: string): Promise<BitgetMarkQuote | null> {
  const symbol = toBitgetPaperSymbol(symbolRaw);
  const base = process.env["BITGET_BASE_URL"]?.trim() || "https://api.bitget.com";
  try {
    const url = `${base}/api/v2/mix/market/ticker?productType=USDT-FUTURES&symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, { headers: { Accept: "application/json", locale: "en-US" } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Record<string, unknown> | Array<Record<string, unknown>>;
    };
    const data = Array.isArray(json.data) ? json.data[0] : json.data;
    if (!data) return null;
    const last = Number(data["lastPr"] ?? data["last"] ?? data["close"]);
    const mark = Number(data["markPrice"] ?? data["indexPrice"] ?? last);
    if (!Number.isFinite(last) || last <= 0) return null;
    return {
      symbol,
      last,
      mark: Number.isFinite(mark) && mark > 0 ? mark : last,
      raw: data,
      metricLabel: "observed",
    };
  } catch {
    return null;
  }
}

export function computeLinearPnl(input: {
  side: "buy" | "sell";
  entry: number;
  exit: number;
  qty: number;
}): number {
  if (!(input.entry > 0) || !(input.exit > 0) || !(input.qty > 0)) return 0;
  const dir = input.side === "buy" ? 1 : -1;
  return dir * (input.exit - input.entry) * input.qty;
}

/**
 * Places a paper/demo order via Bitget UTA v3 REST.
 * Requires Demo API key + header paptrading: 1.
 */
export async function placeBitgetPaperOrder(req: PaperOrderRequest): Promise<PaperOrderResult> {
  const cfg = requirePaperConfig();
  const timestamp = Date.now().toString();
  const path = "/api/v3/trade/place-order";
  const category = req.category ?? "USDT-FUTURES";
  const symbol = toBitgetPaperSymbol(req.symbol);
  const orderType = req.orderType ?? "market";
  const posSide = req.posSide ?? (req.side === "buy" ? "long" : "short");
  const clientOid = `vigil_${randomBytes(8).toString("hex")}`.slice(0, 32);

  const bodyObj: Record<string, string> = {
    category,
    symbol,
    qty: req.size,
    side: req.side,
    orderType,
    clientOid,
  };
  if (category !== "SPOT" && category !== "MARGIN") {
    bodyObj["posSide"] = posSide;
  }
  if (orderType === "limit") {
    if (!req.price) {
      throw new VigilError("VALIDATION_ERROR", "limit orders require price", 400);
    }
    bodyObj["price"] = req.price;
    bodyObj["timeInForce"] = "gtc";
  }

  const body = JSON.stringify(bodyObj);
  const prehash = `${timestamp}POST${path}${body}`;
  const signature = sign(cfg.apiSecret, prehash);

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ACCESS-KEY": cfg.apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": cfg.passphrase,
      locale: "en-US",
      paptrading: "1",
    },
    body,
  });

  const text = await res.text();
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    raw = { body: text };
  }

  if (!res.ok) {
    throw new VigilError(
      "BITGET_PAPER_NOT_CONFIGURED",
      `Bitget paper order HTTP ${res.status}`,
      502,
      raw,
    );
  }

  const code = typeof raw["code"] === "string" ? raw["code"] : "";
  if (code && code !== "00000") {
    throw new VigilError(
      "BITGET_PAPER_NOT_CONFIGURED",
      `Bitget paper order rejected: ${String(raw["msg"] ?? code)}`,
      502,
      raw,
    );
  }

  const data = (raw["data"] as Record<string, unknown> | undefined) ?? {};
  const exchangeOrderId =
    (typeof data["orderId"] === "string" && data["orderId"]) ||
    (typeof data["clientOid"] === "string" && data["clientOid"]) ||
    null;

  return {
    status: code === "00000" ? "accepted" : "submitted",
    exchangeOrderId,
    raw,
    metricLabel: "observed",
  };
}

/** Close an open paper position with opposite market side (Demo). */
export async function closeBitgetPaperOrder(input: {
  symbol: string;
  openSide: "buy" | "sell";
  size: string;
}): Promise<PaperOrderResult> {
  const closeSide = input.openSide === "buy" ? "sell" : "buy";
  const posSide = input.openSide === "buy" ? "long" : "short";
  return placeBitgetPaperOrder({
    symbol: input.symbol,
    side: closeSide,
    size: input.size,
    orderType: "market",
    posSide,
  });
}

export function assertPaperOnlySettings(paperOnly: boolean): void {
  if (!paperOnly) {
    throw new VigilError(
      "PAPER_LOCK_VIOLATION",
      "Tenant paper_only must remain true for VIGIL S2",
      403,
    );
  }
}
