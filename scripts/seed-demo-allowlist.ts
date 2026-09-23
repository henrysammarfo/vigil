#!/usr/bin/env bun
/**
 * Seed FENN allowlist for the demo tenant (UI typing flake workaround).
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/vigil/db/client";
import { tenantSettings, tenants, users } from "../src/vigil/db/schema";

async function main() {
  process.env.DATABASE_URL = process.env.DATABASE_URL?.trim() || "pglite:/tmp/vigil-demo.db";
  const db = await getDb();
  const email = process.argv[2] || "vigil-demo-s2@example.com";
  const u = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u[0]) throw new Error(`user not found: ${email}`);
  // find membership → tenant via tenants list / memberships
  const { memberships } = await import("../src/vigil/db/schema");
  const m = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, u[0].id))
    .limit(1);
  if (!m[0]) throw new Error("no membership");
  const tenantId = m[0].tenantId;
  const allowlist = ["NVDA", "AAPL", "TSLA"];
  await db
    .insert(tenantSettings)
    .values({
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
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tenantSettings.tenantId,
      set: {
        allowlist,
        minConfidence: 50,
        llmDeclared: "agentrouter/deepseek-v4-flash",
        fennMode: true,
        fixedPaperSize: 1,
        weekendWatch: true,
        afterHoursWatch: true,
        paperOnly: true,
        updatedAt: new Date(),
      },
    });
  const t = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  console.log(JSON.stringify({ email, tenantId, tenant: t[0]?.name, allowlist }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
