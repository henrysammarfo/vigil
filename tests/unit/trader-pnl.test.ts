import { describe, expect, it } from "vitest";
import {
  analysisCompleteForPaper,
  parseEntryAnalysis,
} from "../../src/vigil/agent/trader-rubric";
import { computeLinearPnl } from "../../src/vigil/integrations/bitget-paper";
import {
  enrichOrderRow,
  paperScoreboard,
} from "../../src/vigil/agent/paper-ledger";

describe("trader rubric", () => {
  it("parses Investopedia-aligned entry analysis", () => {
    const a = parseEntryAnalysis({
      thesis: "NVDA after-hours pop on named catalyst",
      bullCase: ["headline names product", "move >1%"],
      bearCase: ["thin liquidity", "gap risk into open"],
      invalidation: ["give back >50% of AH move"],
      biasChecks: ["wrote opposing case", "not FOMO chase"],
      sessionRisk: "after-hours spreads wide",
      sizeRule: "fixed 1",
    });
    expect(a?.thesis).toMatch(/NVDA/);
    expect(analysisCompleteForPaper(a)).toBe(true);
  });

  it("rejects incomplete analysis for PAPER_*", () => {
    expect(
      analysisCompleteForPaper(
        parseEntryAnalysis({
          thesis: "thin thesis",
          bullCase: ["one"],
          bearCase: ["only one bear"],
          invalidation: [],
          biasChecks: [],
        }),
      ),
    ).toBe(false);
  });
});

describe("linear paper PnL", () => {
  it("computes long/short PnL", () => {
    expect(computeLinearPnl({ side: "buy", entry: 100, exit: 110, qty: 2 })).toBe(20);
    expect(computeLinearPnl({ side: "sell", entry: 100, exit: 90, qty: 1 })).toBe(10);
    expect(computeLinearPnl({ side: "buy", entry: 100, exit: 95, qty: 1 })).toBe(-5);
  });
});

describe("paper scoreboard", () => {
  it("classifies wins and losses from enriched rows", () => {
    const open = enrichOrderRow({
      id: "o1",
      tenantId: "t",
      decisionId: "d",
      symbol: "NVDAUSDT",
      side: "buy",
      quantity: "1",
      price: "100",
      status: "accepted",
      exchangeOrderId: null,
      rawResponse: {},
      metricLabel: "observed",
      createdAt: new Date(),
      lifecycle: "open",
      markPrice: "105",
      unrealizedPnl: "5",
      exitPrice: null,
      exitExchangeOrderId: null,
      realizedPnl: null,
      closedAt: null,
      entryAnalysis: null,
    });
    const closedWin = enrichOrderRow({
      ...open,
      id: "o2",
      lifecycle: "closed",
      unrealizedPnl: "0",
      realizedPnl: "3.5",
      exitPrice: "103.5",
    });
    const closedLoss = enrichOrderRow({
      ...open,
      id: "o3",
      lifecycle: "closed",
      unrealizedPnl: "0",
      realizedPnl: "-2",
      exitPrice: "98",
    });
    const board = paperScoreboard([open, closedWin, closedLoss]);
    expect(board.open).toBe(1);
    expect(board.closed).toBe(2);
    expect(board.wins).toBe(1);
    expect(board.losses).toBe(1);
    expect(board.realizedPnlSum).toBeCloseTo(1.5);
    expect(open.winLoss).toBe("win");
  });
});
