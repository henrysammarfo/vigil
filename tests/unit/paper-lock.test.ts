import { describe, expect, it } from "vitest";
import { VigilError } from "../../src/vigil/security/errors";
import {
  assertPaperOnlySettings,
  toBitgetPaperSymbol,
} from "../../src/vigil/integrations/bitget-paper";

describe("paper lock", () => {
  it("refuses when tenant paperOnly is false", () => {
    expect(() => assertPaperOnlySettings(false)).toThrow(VigilError);
  });

  it("normalizes tickers to Bitget paper symbols", () => {
    expect(toBitgetPaperSymbol("NVDA")).toBe("NVDAUSDT");
    expect(toBitgetPaperSymbol("rNVDAUSDT")).toBe("NVDAUSDT");
    expect(toBitgetPaperSymbol("nvda-usdt")).toBe("NVDAUSDT");
  });

  it("requires BITGET_PAPER=true before placing orders", async () => {
    const prev = process.env.BITGET_PAPER;
    process.env.BITGET_PAPER = "false";
    process.env.BITGET_API_KEY = "x";
    process.env.BITGET_API_SECRET = "y";
    process.env.BITGET_PASSPHRASE = "z";
    const { placeBitgetPaperOrder } = await import("../../src/vigil/integrations/bitget-paper");
    await expect(
      placeBitgetPaperOrder({ symbol: "NVDAUSDT", side: "buy", size: "1" }),
    ).rejects.toMatchObject({ code: "PAPER_LOCK_VIOLATION" });
    process.env.BITGET_PAPER = prev;
  });
});
