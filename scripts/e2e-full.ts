#!/usr/bin/env bun
/**
 * Full VIGIL e2e: TinyFish news → FENN allowlist → Tor LLM → Bitget Demo paper → export.
 */
import { eq } from "drizzle-orm";
import { runVigilPipeline } from "../src/vigil/agent/pipeline";
import { evaluateClosedWindow } from "../src/vigil/agent/closed-window";
import { getDb } from "../src/vigil/db/client";
import {
  decisions,
  paperOrders,
  tenantSettings,
  tenants,
  whyCards,
} from "../src/vigil/db/schema";
import { newId } from "../src/vigil/security/crypto";
import { writeFileSync, mkdirSync } from "node:fs";

async function main() {
  process.env.DATABASE_URL = process.env.DATABASE_URL?.trim() || "pglite:memory";
  process.env.SESSION_SECRET =
    process.env.SESSION_SECRET?.trim() || "dev-session-secret-32chars-minimum!!";
  process.env.AGENTROUTER_USE_TOR = process.env.AGENTROUTER_USE_TOR || "1";
  process.env.BITGET_PAPER = "true";
  process.env.VIGIL_LLM_MODEL = process.env.VIGIL_LLM_MODEL || "deepseek-v4-flash";
  process.env.VIGIL_LLM_ORDER =
    process.env.VIGIL_LLM_ORDER || "agentrouter,agentrouter-anthropic,venice,dashscope";

  if (!process.env.TINYFISH_API_KEY?.trim()) throw new Error("TINYFISH_API_KEY missing");
  if (!process.env.AGENTROUTER_API_KEY?.trim() && process.env.KEY) {
    process.env.AGENTROUTER_API_KEY = process.env.KEY;
  }
  if (!process.env.AGENTROUTER_API_KEY?.trim()) throw new Error("AGENTROUTER_API_KEY missing");
  if (!process.env.BITGET_API_KEY?.trim()) throw new Error("BITGET_API_KEY missing");

  const window = evaluateClosedWindow();
  console.log("window", window);
  if (!window.allowed) {
    console.error("closed window not active — cannot run full paper cycle now");
    process.exit(2);
  }

  const db = await getDb();
  const tenantId = newId("ten");
  const allowlist = ["NVDA", "AAPL", "TSLA"];
  await db.insert(tenants).values({
    id: tenantId,
    slug: `e2e-${Date.now()}`,
    name: "VIGIL E2E",
  });
  await db.insert(tenantSettings).values({
    tenantId,
    weekendWatch: true,
    afterHoursWatch: true,
    paperOnly: true,
    maxPositionUsd: 5000,
    minConfidence: 50,
    llmDeclared: "agentrouter/deepseek-v4-flash",
    fennMode: true,
    allowlist,
    fixedPaperSize: 1,
  });

  console.log("running pipeline allowlist=", allowlist);
  const result = await runVigilPipeline(tenantId);
  console.log("pipeline", JSON.stringify(result, null, 2).slice(0, 2000));

  const decs = await db.select().from(decisions).where(eq(decisions.tenantId, tenantId));
  const orders = await db.select().from(paperOrders).where(eq(paperOrders.tenantId, tenantId));
  const cards = await db.select().from(whyCards).where(eq(whyCards.tenantId, tenantId));

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    tenantId,
    paperOnly: true as const,
    window,
    pipeline: result,
    orders,
    decisions: decs,
    whyCards: cards.map((c) => ({
      id: c.id,
      seq: c.seq,
      contentHash: c.contentHash,
      prevHash: c.prevHash,
      sealedAt: c.sealedAt,
      payload: c.payload,
    })),
  };

  mkdirSync("/opt/cursor/artifacts", { recursive: true });
  const outPath = `/opt/cursor/artifacts/vigil-paper-log-${Date.now()}.json`;
  writeFileSync(outPath, JSON.stringify(exportPayload, null, 2));
  console.log("export", outPath);
  console.log(
    "summary",
    JSON.stringify({
      status: result.status,
      decisions: decs.length,
      orders: orders.length,
      whyCards: cards.length,
      paperActions: orders.map((o) => ({ symbol: o.symbol, side: o.side, status: o.status, exchangeOrderId: o.exchangeOrderId })),
      decisionActions: decs.map((d) => ({ action: d.action, ticker: d.llmProvider, conf: d.confidence })),
    }),
  );

  if (result.status === "failed") process.exit(1);
  if (cards.length === 0) {
    console.error("no why-cards sealed");
    process.exit(1);
  }
  if (orders.length < 1) {
    console.error("expected ≥1 Bitget Demo paper order for submission proof");
    process.exit(1);
  }
  console.log("e2e_full_ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
