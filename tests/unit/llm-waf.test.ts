import { describe, expect, it } from "vitest";
import {
  agentrouterAnthropicBases,
  agentrouterOpenAiBases,
  agentrouterStainlessHeaders,
  looksLikeWaf,
} from "../../src/vigil/integrations/llm";

describe("AgentRouter WAF helpers", () => {
  it("detects Aliyun captcha HTML as WAF", () => {
    const html = '<!doctype html><meta name="aliyun_waf_aa" content="x"><title></title>';
    expect(looksLikeWaf(200, html, "text/html; charset=utf-8")).toBe(true);
  });

  it("detects unauthorized client fingerprint reject as WAF", () => {
    const body = JSON.stringify({
      error: { message: "unauthorized client detected, contact support" },
    });
    expect(looksLikeWaf(401, body, "application/json")).toBe(true);
  });

  it("does not treat Invalid API Key JSON as WAF", () => {
    const body = JSON.stringify({ code: 401, msg: "Invalid API Key!", data: null });
    expect(looksLikeWaf(401, body, "application/json")).toBe(false);
  });

  it("ships QwenCode + stainless headers for allowlisted clients", () => {
    const h = agentrouterStainlessHeaders("sk-test");
    expect(h["User-Agent"]).toMatch(/QwenCode/);
    expect(h["x-stainless-lang"]).toBe("js");
    expect(h.Authorization).toBe("Bearer sk-test");
  });

  it("OpenAI bases include /v1 and prefer co portal host", () => {
    const bases = agentrouterOpenAiBases();
    expect(bases[0]).toMatch(/\/v1$/);
    expect(bases.some((b) => b.includes("co.agentrouter.org"))).toBe(true);
  });

  it("Anthropic bases omit /v1 (SDK appends /v1/messages)", () => {
    const bases = agentrouterAnthropicBases();
    for (const b of bases) {
      expect(b.endsWith("/v1")).toBe(false);
    }
  });
});
