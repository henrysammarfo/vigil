/**
 * Live Demo: refresh marks on open paper orders + optional exit one.
 * Usage: bun scripts/mark-paper-pnl.ts [--close <orderId>]
 */
import { getDb } from "../src/vigil/db/client";
import { paperOrders } from "../src/vigil/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  closeOpenPaperOrder,
  listEnrichedPaperOrders,
  paperScoreboard,
  refreshOpenPaperMarks,
} from "../src/vigil/agent/paper-ledger";
import { fetchBitgetMarkQuote } from "../src/vigil/integrations/bitget-paper";

async function main() {
  const args = process.argv.slice(2);
  const closeIdx = args.indexOf("--close");
  const closeId = closeIdx >= 0 ? args[closeIdx + 1] : null;

  for (const sym of ["NVDAUSDT", "AAPLUSDT"]) {
    const q = await fetchBitgetMarkQuote(sym);
    console.log("quote", sym, q ? { last: q.last, mark: q.mark } : null);
  }

  const db = await getDb();
  const tenants = await db
    .selectDistinct({ tenantId: paperOrders.tenantId })
    .from(paperOrders)
    .orderBy(desc(paperOrders.createdAt))
    .limit(5);

  if (!tenants.length) {
    console.log("no paper_orders in db");
    return;
  }

  for (const t of tenants) {
    console.log("tenant", t.tenantId);
    const marked = await refreshOpenPaperMarks(t.tenantId);
    console.log(
      "marked",
      marked.map((m) => ({
        id: m.id,
        symbol: m.symbol,
        entry: m.price,
        mark: m.markPrice,
        uPnl: m.unrealizedPnl,
      })),
    );
    if (closeId) {
      const belongs = marked.find((m) => m.id === closeId) ||
        (await listEnrichedPaperOrders(t.tenantId, 100)).find((m) => m.id === closeId);
      if (belongs) {
        const closed = await closeOpenPaperOrder(t.tenantId, closeId);
        console.log("closed", {
          id: closed.id,
          exit: closed.exitPrice,
          realized: closed.realizedPnl,
          winLoss: closed.winLoss,
        });
      }
    }
    const all = await listEnrichedPaperOrders(t.tenantId, 50);
    console.log("scoreboard", paperScoreboard(all));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
