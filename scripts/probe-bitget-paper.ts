#!/usr/bin/env bun
import { placeBitgetPaperOrder, toBitgetPaperSymbol } from "../src/vigil/integrations/bitget-paper";

console.log("symbol", toBitgetPaperSymbol("NVDA"));
try {
  const r = await placeBitgetPaperOrder({ symbol: "NVDA", side: "buy", size: "1" });
  console.log("ORDER_OK", r.status, r.exchangeOrderId, JSON.stringify(r.raw).slice(0, 400));
} catch (e: unknown) {
  const err = e as { code?: string; message?: string; details?: unknown };
  console.log("ORDER_ERR", err.code, err.message, JSON.stringify(err.details ?? {}).slice(0, 500));
}
