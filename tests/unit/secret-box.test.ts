import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "../../src/vigil/security/secret-box";

describe("secret-box", () => {
  it("round-trips plaintext", () => {
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || "test-session-secret-32chars-minimum!!";
    const sealed = sealSecret(JSON.stringify({ apiKey: "abc", apiSecret: "def" }));
    expect(sealed.split(".").length).toBe(3);
    const opened = JSON.parse(openSecret(sealed)) as { apiKey: string };
    expect(opened.apiKey).toBe("abc");
  });

  it("rejects tampered ciphertext", () => {
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || "test-session-secret-32chars-minimum!!";
    const sealed = sealSecret("hello");
    const parts = sealed.split(".");
    parts[2] = Buffer.from("tamper").toString("base64url");
    expect(() => openSecret(parts.join("."))).toThrow();
  });
});
