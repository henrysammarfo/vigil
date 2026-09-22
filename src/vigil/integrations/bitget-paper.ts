import { createHmac } from "node:crypto";
import { VigilError } from "../security/errors";

export type PaperOrderRequest = {
  symbol: string;
  side: "buy" | "sell";
  size: string;
  orderType?: "market" | "limit";
  price?: string;
};

export type PaperOrderResult = {
  status: string;
  exchangeOrderId: string | null;
  raw: Record<string, unknown>;
  metricLabel: "observed";
};

function requirePaperConfig(): {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  baseUrl: string;
} {
  const paper = process.env.BITGET_PAPER?.trim().toLowerCase();
  if (paper !== "true" && paper !== "1" && paper !== "yes") {
    throw new VigilError(
      "PAPER_LOCK_VIOLATION",
      "BITGET_PAPER must be true. Live execution is forbidden for VIGIL S2.",
      403,
    );
  }
  const apiKey = process.env.BITGET_API_KEY?.trim();
  const apiSecret = process.env.BITGET_API_SECRET?.trim();
  const passphrase = process.env.BITGET_PASSPHRASE?.trim();
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
    baseUrl: process.env.BITGET_BASE_URL?.trim() || "https://api.bitget.com",
  };
}

function sign(secret: string, prehash: string): string {
  return createHmac("sha256", secret).update(prehash).digest("base64");
}

/**
 * Places a paper/demo order via Bitget UTA-style REST.
 * Uses Demo credentials only when BITGET_PAPER=true.
 * Endpoint path follows Bitget mix/spot place-order conventions; response is stored raw.
 */
export async function placeBitgetPaperOrder(req: PaperOrderRequest): Promise<PaperOrderResult> {
  const cfg = requirePaperConfig();
  const timestamp = Date.now().toString();
  const path = "/api/v2/mix/order/place-order";
  const bodyObj = {
    symbol: req.symbol,
    productType: "USDT-FUTURES",
    marginMode: "crossed",
    marginCoin: "USDT",
    size: req.size,
    side: req.side,
    orderType: req.orderType ?? "market",
    force: "gtc",
    ...(req.price ? { price: req.price } : {}),
  };
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
      // Demo / paper routing header used by Bitget demo environments
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

  const data = (raw.data as Record<string, unknown> | undefined) ?? {};
  const exchangeOrderId =
    (typeof data.orderId === "string" && data.orderId) ||
    (typeof data.clientOid === "string" && data.clientOid) ||
    null;

  return {
    status: typeof raw.code === "string" && raw.code === "00000" ? "accepted" : "submitted",
    exchangeOrderId,
    raw,
    metricLabel: "observed",
  };
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
