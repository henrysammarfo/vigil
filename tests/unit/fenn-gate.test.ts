import { describe, expect, it } from "vitest";
import { evaluateFennGates, fixedPaperQuantity, parseAllowlist } from "../../src/vigil/agent/fenn";

describe("FENN gates", () => {
  it("parses empty allowlist by default", () => {
    expect(parseAllowlist([])).toEqual([]);
    expect(parseAllowlist(null)).toEqual([]);
  });

  it("refuses paper when allowlist is empty", () => {
    const d = evaluateFennGates({
      fennMode: true,
      allowlist: [],
      ticker: "NVDA",
      paperedTickers: new Set(),
      sidesByTicker: new Map(),
    });
    expect(d.allowPaper).toBe(false);
    if (!d.allowPaper) expect(d.gate).toBe("allowlist");
  });

  it("allows only allowlisted ticker once", () => {
    const ok = evaluateFennGates({
      fennMode: true,
      allowlist: ["NVDA"],
      ticker: "NVDA",
      paperedTickers: new Set(),
      sidesByTicker: new Map(),
    });
    expect(ok.allowPaper).toBe(true);

    const again = evaluateFennGates({
      fennMode: true,
      allowlist: ["NVDA"],
      ticker: "NVDA",
      paperedTickers: new Set(["NVDA"]),
      sidesByTicker: new Map([["NVDA", "buy"]]),
      proposedSide: "sell",
    });
    expect(again.allowPaper).toBe(false);
  });

  it("keeps fixed paper size small", () => {
    expect(fixedPaperQuantity(1)).toBe("1");
    expect(fixedPaperQuantity(999)).toBe("10");
  });
});
