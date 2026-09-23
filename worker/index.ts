/**
 * VIGIL continuous worker — intended for Cloud Run.
 * Runs the closed-window pipeline on an interval for the configured tenant.
 *
 * Usage:
 *   DATABASE_URL=... SESSION_SECRET=... TINYFISH_API_KEY=... \
 *   AGENTROUTER_API_KEY=... BITGET_*=... BITGET_PAPER=true \
 *   bun worker/index.ts
 */
import { eq } from "drizzle-orm";
import { runVigilPipeline } from "../src/vigil/agent/pipeline";
import { getDb } from "../src/vigil/db/client";
import { tenants } from "../src/vigil/db/schema";

async function resolveTenantId(): Promise<string> {
  const explicit = process.env.VIGIL_WORKER_TENANT_ID?.trim();
  if (explicit) return explicit;
  const slug = process.env.VIGIL_DEFAULT_TENANT_SLUG?.trim();
  if (!slug) {
    throw new Error("Set VIGIL_WORKER_TENANT_ID or VIGIL_DEFAULT_TENANT_SLUG");
  }
  const db = await getDb();
  const rows = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!rows[0]) {
    throw new Error(`Tenant slug not found: ${slug}`);
  }
  return rows[0].id;
}

async function tick() {
  const tenantId = await resolveTenantId();
  const result = await runVigilPipeline(tenantId);
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      runId: result.runId,
      status: result.status,
      windowState: result.windowState,
      errorCode: result.errorCode,
    }),
  );
}

async function main() {
  const interval = Number(process.env.VIGIL_WORKER_INTERVAL_MS ?? 60_000);
  console.log(`VIGIL worker starting · interval=${interval}ms · paper-only`);
  await tick();
  setInterval(() => {
    void tick().catch((error) => {
      console.error("worker tick failed", error);
    });
  }, interval);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
