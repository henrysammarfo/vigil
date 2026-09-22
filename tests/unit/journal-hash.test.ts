import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

describe("why-card hash chain", () => {
  it("chains prevHash into contentHash", () => {
    const prevHash = "GENESIS";
    const body = { action: "NO_TRADE", ticker: "NVDA" };
    const seq = 1;
    const contentHash = createHash("sha256")
      .update(JSON.stringify({ seq, prevHash, body }))
      .digest("hex");
    expect(contentHash).toHaveLength(64);

    const next = createHash("sha256")
      .update(JSON.stringify({ seq: 2, prevHash: contentHash, body: { action: "PAPER_BUY" } }))
      .digest("hex");
    expect(next).not.toEqual(contentHash);
  });
});
