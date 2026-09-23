#!/usr/bin/env bun
/**
 * Smoke: FENN refuse-by-default end-to-end.
 * Empty allowlist → NO_TRADE why-cards without LLM or Bitget.
 * Requires TINYFISH_API_KEY + live closed window (or skip with clear exit).
 */
import { eq } from "drizzle-orm";
import { runVigilPipeline } from "../src/vigil/agent/pipeline";
import { evaluateClosedWindow } from "../src/vigil/agent/closed-window";
import { getDb } from "../src/vigil/db/client";
import { decisions, tenantSettings, tenants, whyCards } from "../src/vigil/db/schema";
import { newId } from "../src/vigil/security/crypto";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = "pglite:memory";
  }
  if (!process.env.SESSION_SECRET?.trim()) {
    process.env.SESSION_SECRET = "dev-session-secret-32chars-minimum!!";
  }
  if (!process.env.TINYFISH_API_KEY?.trim() && process.env.KEY) {
    // ignore
  }

  const window = evaluateClosedWindow();
  console.log("window", window.state, "allowed", window.allowed);
  if (!window.allowed) {
    console.log("smoke_fenn_skipped_open_market", window.reason ?? window.state);
    process.exit(0);
  }

  const key = process.env.TINYFISH_API_KEY?.trim();
  if (!key) {
    console.error("TINYFISH_API_KEY missing");
    process.exit(1);
  }

  const db = await getDb();
  const tenantId = newId("ten");
  await db.insert(tenants).values({
    id: tenantId,
    slug: `fenn-smoke-${Date.now()}`,
    name: "FENN Smoke",
  });
  await db.insert(tenantSettings).values({
    tenantId,
    weekendWatch: true,
    afterHoursWatch: true,
    paperOnly: true,
    maxPositionUsd: 5000,
    minConfidence: 70,
    llmDeclared: "fenn-gate/deterministic",
    fennMode: true,
    allowlist: [],
    fixedPaperSize: 1,
  });

  const result = await runVigilPipeline(tenantId);
  console.log("pipeline", result.status, result.summary);

  const decs = await db.select().from(decisions).where(eq(decisions.tenantId, tenantId));
  const cards = await db.select().from(whyCards).where(eq(whyCards.tenantId, tenantId));

  const allFenn = decs.every((d) => d.llmProvider === "fenn-gate" && d.action === "NO_TRADE");
  if (result.status === "failed") {
    console.error("pipeline failed", result.errorCode, result.errorMessage);
    process.exit(1);
  }
  if (decs.length === 0 || cards.length === 0) {
    console.error("expected sealed NO why-cards; got", {
      decisions: decs.length,
      whyCards: cards.length,
    });
    process.exit(1);
  }
  if (!allFenn) {
    console.error("expected all fenn-gate NO_TRADE decisions", decs);
    process.exit(1);
  }

  console.log("fenn_refused", decs.length, "why_cards", cards.length);
  console.log("smoke_fenn_ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
