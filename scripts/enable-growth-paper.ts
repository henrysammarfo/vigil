/**
 * Enable $100→$5000 growth paper mode for a tenant:
 * - Seed allowlist with high-WR pairs (NVDA AMD AAPL TSLA)
 * - Ensure Bitget paper path + AgentRouter Tor
 * - Optionally run one pipeline tick
 *
 *   bun scripts/enable-growth-paper.ts --tenant=<id|slug> [--run]
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/vigil/db/client";
import { tenantSettings, tenants } from "../src/vigil/db/schema";
import { GROWTH_ALLOWLIST, GROWTH_TARGET_USD } from "../src/vigil/agent/growth";
import { runVigilPipeline } from "../src/vigil/agent/pipeline";
import { listEnrichedPaperOrders, paperScoreboard } from "../src/vigil/agent/paper-ledger";

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function main() {
  const wantRun = process.argv.includes("--run");
  const key = arg("tenant") || process.env["VIGIL_WORKER_TENANT_ID"] || process.env["VIGIL_DEFAULT_TENANT_SLUG"];
  if (!key) {
    console.error("Pass --tenant=<id|slug> or set VIGIL_WORKER_TENANT_ID / VIGIL_DEFAULT_TENANT_SLUG");
    process.exit(1);
  }

  process.env["BITGET_PAPER"] = "true";
  process.env["VIGIL_ALLOW_ENV_BITGET"] = process.env["VIGIL_ALLOW_ENV_BITGET"] || "1";
  process.env["AGENTROUTER_USE_TOR"] = process.env["AGENTROUTER_USE_TOR"] || "1";
  process.env["VIGIL_GROWTH_ALLOWLIST"] = "1";

  const db = await getDb();
  let tenantId = key;
  const byId = await db.select().from(tenants).where(eq(tenants.id, key)).limit(1);
  if (!byId[0]) {
    const bySlug = await db.select().from(tenants).where(eq(tenants.slug, key)).limit(1);
    if (!bySlug[0]) {
      console.error("Tenant not found:", key);
      process.exit(1);
    }
    tenantId = bySlug[0].id;
  }

  const allowlist = [...GROWTH_ALLOWLIST];
  await db
    .insert(tenantSettings)
    .values({
      tenantId,
      paperOnly: true,
      fennMode: true,
      allowlist,
      fixedPaperSize: 1,
      maxPositionUsd: GROWTH_TARGET_USD,
      minConfidence: 70,
      weekendWatch: true,
      afterHoursWatch: true,
      llmDeclared: "agentrouter/deepseek-v4-flash",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tenantSettings.tenantId,
      set: {
        paperOnly: true,
        fennMode: true,
        allowlist,
        maxPositionUsd: GROWTH_TARGET_USD,
        weekendWatch: true,
        afterHoursWatch: true,
        updatedAt: new Date(),
      },
    });

  const orders = await listEnrichedPaperOrders(tenantId, 100);
  const sb = paperScoreboard(orders);
  console.log(
    JSON.stringify(
      {
        tenantId,
        allowlist,
        bankroll: sb.bankroll,
        targetUsd: GROWTH_TARGET_USD,
        remainingUsd: Math.max(0, GROWTH_TARGET_USD - sb.bankroll.equityUsd),
        agentRouterTor: process.env["AGENTROUTER_USE_TOR"],
        bitgetPaper: process.env["BITGET_PAPER"],
      },
      null,
      2,
    ),
  );

  if (wantRun) {
    const result = await runVigilPipeline(tenantId);
    console.log(
      JSON.stringify(
        {
          runId: result.runId,
          status: result.status,
          windowState: result.windowState,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          summary: result.summary,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("Growth allowlist saved. Re-run with --run to execute one closed-window cycle.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
