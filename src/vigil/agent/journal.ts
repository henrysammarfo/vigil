import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { whyCards } from "../db/schema";
import { newId } from "../security/crypto";

export type WhyCardBody = {
  eventId: string;
  signalId: string;
  decisionId: string;
  paperOrderId: string | null;
  headline: string;
  ticker: string;
  action: string;
  confidence: number;
  windowState: string;
  llmProvider: string;
  llmModel: string;
  rationale: string;
  metricLabels: Record<string, string>;
  gates: string[];
  /** Investopedia-aligned trader entry rubric (when scored) */
  entryAnalysis?: Record<string, unknown>;
};

export async function sealWhyCard(
  tenantId: string,
  decisionId: string,
  body: WhyCardBody,
): Promise<{ id: string; seq: number; contentHash: string; prevHash: string }> {
  const db = await getDb();
  const latest = await db
    .select()
    .from(whyCards)
    .where(eq(whyCards.tenantId, tenantId))
    .orderBy(desc(whyCards.seq))
    .limit(1);

  const prev = latest[0];
  const prevHash = prev?.contentHash ?? "GENESIS";
  const seq = (prev?.seq ?? 0) + 1;
  const payload = { seq, prevHash, body };
  const contentHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const id = newId("why");

  await db.insert(whyCards).values({
    id,
    tenantId,
    decisionId,
    seq,
    prevHash,
    contentHash,
    body,
  });

  return { id, seq, contentHash, prevHash };
}

export async function listWhyCards(tenantId: string, limit = 50) {
  const db = await getDb();
  return db
    .select()
    .from(whyCards)
    .where(eq(whyCards.tenantId, tenantId))
    .orderBy(desc(whyCards.seq))
    .limit(limit);
}

export async function getWhyCard(tenantId: string, id: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(whyCards)
    .where(and(eq(whyCards.tenantId, tenantId), eq(whyCards.id, id)))
    .limit(1);
  return rows[0] ?? null;
}
