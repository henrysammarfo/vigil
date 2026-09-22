/**
 * Paper mark-to-market + mark-to-exit ledger (Bitget Demo).
 * Honest Demo scoreboard: open unrealized + closed realized wins/losses.
 */

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { paperOrders } from "../db/schema";
import {
  closeBitgetPaperOrder,
  computeLinearPnl,
  fetchBitgetMarkQuote,
} from "../integrations/bitget-paper";
import { VigilError } from "../security/errors";

export type EnrichedPaperOrder = typeof paperOrders.$inferSelect & {
  pnlStatus: "open" | "closed" | "unknown";
  pnlUsd: number | null;
  winLoss: "win" | "loss" | "flat" | null;
};

function asSide(side: string): "buy" | "sell" {
  return side === "sell" ? "sell" : "buy";
}

function fmt(n: number): string {
  return n.toFixed(6);
}

function classify(pnl: number | null): "win" | "loss" | "flat" | null {
  if (pnl == null || !Number.isFinite(pnl)) return null;
  if (Math.abs(pnl) < 1e-8) return "flat";
  return pnl > 0 ? "win" : "loss";
}

export function enrichOrderRow(row: typeof paperOrders.$inferSelect): EnrichedPaperOrder {
  const lifecycle = (row.lifecycle || "open") as "open" | "closed";
  let pnlUsd: number | null = null;
  if (lifecycle === "closed" && row.realizedPnl != null) {
    const n = Number(row.realizedPnl);
    pnlUsd = Number.isFinite(n) ? n : null;
  } else if (row.unrealizedPnl != null) {
    const n = Number(row.unrealizedPnl);
    pnlUsd = Number.isFinite(n) ? n : null;
  }
  return {
    ...row,
    pnlStatus: lifecycle === "closed" ? "closed" : row.lifecycle ? "open" : "unknown",
    pnlUsd,
    winLoss: classify(pnlUsd),
  };
}

/** Refresh mark + unrealized PnL for all open paper orders of a tenant. */
export async function refreshOpenPaperMarks(tenantId: string): Promise<EnrichedPaperOrder[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(paperOrders)
    .where(and(eq(paperOrders.tenantId, tenantId), eq(paperOrders.lifecycle, "open")))
    .orderBy(desc(paperOrders.createdAt));

  const out: EnrichedPaperOrder[] = [];
  for (const row of rows) {
    const quote = await fetchBitgetMarkQuote(row.symbol);
    if (!quote) {
      out.push(enrichOrderRow(row));
      continue;
    }
    const qty = Number(row.quantity);
    let entry = Number(row.price);
    const patch: Partial<typeof paperOrders.$inferInsert> = {
      markPrice: fmt(quote.mark),
    };
    // Backfill entry from first observed mark when fill price was unknown
    if (!(entry > 0)) {
      entry = quote.mark;
      patch.price = fmt(entry);
    }
    if (entry > 0 && qty > 0) {
      const u = computeLinearPnl({
        side: asSide(row.side),
        entry,
        exit: quote.mark,
        qty,
      });
      patch.unrealizedPnl = fmt(u);
    }
    await db.update(paperOrders).set(patch).where(eq(paperOrders.id, row.id));
    out.push(
      enrichOrderRow({
        ...row,
        price: typeof patch.price === "string" ? patch.price : row.price,
        markPrice: typeof patch.markPrice === "string" ? patch.markPrice : row.markPrice,
        unrealizedPnl:
          typeof patch.unrealizedPnl === "string" ? patch.unrealizedPnl : row.unrealizedPnl,
      }),
    );
  }
  return out;
}

/** Mark-to-exit: opposite Demo market close + realized PnL. */
export async function closeOpenPaperOrder(
  tenantId: string,
  orderId: string,
): Promise<EnrichedPaperOrder> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(paperOrders)
    .where(and(eq(paperOrders.id, orderId), eq(paperOrders.tenantId, tenantId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new VigilError("NOT_FOUND", "Paper order not found", 404);
  }
  if ((row.lifecycle || "open") === "closed") {
    throw new VigilError("VALIDATION_ERROR", "Paper order already closed", 400);
  }

  const close = await closeBitgetPaperOrder({
    symbol: row.symbol,
    openSide: asSide(row.side),
    size: row.quantity,
  });

  const quote = await fetchBitgetMarkQuote(row.symbol);
  const exitPx = quote?.mark ?? (row.markPrice ? Number(row.markPrice) : NaN);
  let entry = Number(row.price);
  if (!(entry > 0) && quote) entry = quote.mark;
  const qty = Number(row.quantity);
  const realized =
    entry > 0 && exitPx > 0 && qty > 0
      ? computeLinearPnl({ side: asSide(row.side), entry, exit: exitPx, qty })
      : 0;

  const patch = {
    lifecycle: "closed",
    status: close.status,
    exitPrice: Number.isFinite(exitPx) ? fmt(exitPx) : null,
    exitExchangeOrderId: close.exchangeOrderId,
    realizedPnl: fmt(realized),
    unrealizedPnl: "0",
    markPrice: Number.isFinite(exitPx) ? fmt(exitPx) : row.markPrice,
    price: row.price ?? (entry > 0 ? fmt(entry) : null),
    closedAt: new Date(),
    rawResponse: {
      ...(row.rawResponse as Record<string, unknown>),
      close: close.raw,
    },
  };

  await db.update(paperOrders).set(patch).where(eq(paperOrders.id, row.id));
  return enrichOrderRow({ ...row, ...patch });
}

export async function listEnrichedPaperOrders(
  tenantId: string,
  limit = 50,
): Promise<EnrichedPaperOrder[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(paperOrders)
    .where(eq(paperOrders.tenantId, tenantId))
    .orderBy(desc(paperOrders.createdAt))
    .limit(limit);
  return rows.map(enrichOrderRow);
}

export function paperScoreboard(orders: EnrichedPaperOrder[]): {
  open: number;
  closed: number;
  wins: number;
  losses: number;
  flats: number;
  realizedPnlSum: number;
  unrealizedPnlSum: number;
} {
  let open = 0;
  let closed = 0;
  let wins = 0;
  let losses = 0;
  let flats = 0;
  let realizedPnlSum = 0;
  let unrealizedPnlSum = 0;
  for (const o of orders) {
    if (o.pnlStatus === "closed") {
      closed += 1;
      const r = Number(o.realizedPnl ?? 0);
      if (Number.isFinite(r)) realizedPnlSum += r;
      if (o.winLoss === "win") wins += 1;
      else if (o.winLoss === "loss") losses += 1;
      else if (o.winLoss === "flat") flats += 1;
    } else {
      open += 1;
      const u = Number(o.unrealizedPnl ?? 0);
      if (Number.isFinite(u)) unrealizedPnlSum += u;
    }
  }
  return { open, closed, wins, losses, flats, realizedPnlSum, unrealizedPnlSum };
}
