/**
 * Durable per-tenant daily counters (survives serverless cold starts).
 * Used for hard chat quotas so free-tier API keys are not burned.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { usageCounters } from "../db/schema";
import { newId } from "../security/crypto";

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function getDailyCount(tenantId: string, bucket: string): Promise<number> {
  const db = await getDb();
  const day = utcDayKey();
  const rows = await db
    .select()
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.tenantId, tenantId),
        eq(usageCounters.bucket, bucket),
        eq(usageCounters.dayKey, day),
      ),
    )
    .limit(1);
  return rows[0]?.count ?? 0;
}

/** Atomically increment; returns { allowed, count, limit }. */
export async function tryConsumeDaily(
  tenantId: string,
  bucket: string,
  limit: number,
): Promise<{ allowed: boolean; count: number; limit: number; dayKey: string }> {
  const db = await getDb();
  const dayKey = utcDayKey();
  const existing = await db
    .select()
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.tenantId, tenantId),
        eq(usageCounters.bucket, bucket),
        eq(usageCounters.dayKey, dayKey),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    if (limit <= 0) {
      return { allowed: false, count: 0, limit, dayKey };
    }
    await db.insert(usageCounters).values({
      id: newId("uc"),
      tenantId,
      bucket,
      dayKey,
      count: 1,
      updatedAt: new Date(),
    });
    return { allowed: true, count: 1, limit, dayKey };
  }

  if (existing[0].count >= limit) {
    return { allowed: false, count: existing[0].count, limit, dayKey };
  }

  await db
    .update(usageCounters)
    .set({ count: existing[0].count + 1, updatedAt: new Date() })
    .where(eq(usageCounters.id, existing[0].id));

  return { allowed: true, count: existing[0].count + 1, limit, dayKey };
}

export function chatDailyLimit(): number {
  const n = Number(process.env["VIGIL_CHAT_DAILY_LIMIT"] ?? "3");
  return Number.isFinite(n) ? Math.max(0, Math.min(Math.floor(n), 20)) : 3;
}
