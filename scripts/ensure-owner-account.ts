/**
 * Ensure owner workspace exists (register if missing) and optionally seed growth allowlist.
 * Does NOT print secrets. Usage:
 *   bun scripts/ensure-owner-account.ts --email=you@example.com --password='…'
 * Optional: --allowlist=NVDA,AMD,AAPL,TSLA
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/vigil/db/client";
import { tenantSettings, users } from "../src/vigil/db/schema";
import { loginUser, registerUser } from "../src/vigil/auth/session";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  const email = (arg("email") || process.env.VIGIL_OWNER_EMAIL || "").trim().toLowerCase();
  const password = arg("password") || process.env.VIGIL_OWNER_PASSWORD || "";
  const allowlistRaw = arg("allowlist") || "NVDA,AMD,AAPL,TSLA";

  if (!email || !email.includes("@")) {
    console.error("Usage: bun scripts/ensure-owner-account.ts --email=… --password=…");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Password must be ≥10 characters");
    process.exit(1);
  }

  const db = await getDb();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  let tenantId: string;
  let userId: string;
  let created = false;

  if (existing[0]) {
    const login = await loginUser({ email, password });
    tenantId = login.ctx.tenantId;
    userId = login.ctx.userId;
    console.log(JSON.stringify({ ok: true, action: "login", email, tenantId, userId }));
  } else {
    const reg = await registerUser({
      email,
      password,
      displayName: "Henry",
    });
    tenantId = reg.ctx.tenantId;
    userId = reg.ctx.userId;
    created = true;
    console.log(JSON.stringify({ ok: true, action: "register", email, tenantId, userId }));
  }

  const allowlist = [
    ...new Set(
      allowlistRaw
        .split(/[\s,]+/)
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];

  await db
    .insert(tenantSettings)
    .values({
      tenantId,
      weekendWatch: true,
      afterHoursWatch: true,
      paperOnly: true,
      maxPositionUsd: 5000,
      minConfidence: 70,
      llmDeclared: "agentrouter/venice",
      fennMode: true,
      allowlist,
      fixedPaperSize: 1,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tenantSettings.tenantId,
      set: {
        allowlist,
        fennMode: true,
        paperOnly: true,
        updatedAt: new Date(),
      },
    });

  console.log(
    JSON.stringify({
      ok: true,
      created,
      tenantId,
      allowlist,
      next: [
        "Sign in at /auth with this email",
        "Settings → Your Bitget Demo → paste Demo API key/secret/passphrase",
        "Overview → Run agent after US close (or worker with VIGIL_GROWTH_ALLOWLIST=1)",
        "Desk chat: 3 messages/day UTC default (VIGIL_CHAT_DAILY_LIMIT)",
      ],
    }),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
