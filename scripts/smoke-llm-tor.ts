#!/usr/bin/env bun
/**
 * Smoke: AgentRouter via Tor SOCKS (clears Aliyun captcha on cloud VMs).
 * Requires: AGENTROUTER_API_KEY, tor on :9050 (bun run tor:start)
 */
import {
  agentrouterModels,
  agentrouterOpenAiBases,
  scoreEventWithLlm,
  shouldUseTor,
  torSocksUrl,
} from "../src/vigil/integrations/llm";

async function main() {
  process.env.AGENTROUTER_USE_TOR = process.env.AGENTROUTER_USE_TOR || "1";
  const key = process.env.AGENTROUTER_API_KEY?.trim() || process.env.KEY?.trim();
  if (!key) {
    console.error("AGENTROUTER_API_KEY missing");
    process.exit(1);
  }
  process.env.AGENTROUTER_API_KEY = key;
  process.env.VIGIL_LLM_ORDER = "agentrouter";
  if (!shouldUseTor()) {
    console.error("Tor disabled");
    process.exit(1);
  }
  console.log(
    "tor",
    torSocksUrl(),
    "models",
    agentrouterModels().slice(0, 3),
    "bases",
    agentrouterOpenAiBases(),
  );

  const result = await scoreEventWithLlm({
    headline: "Smoke test closed-market headline",
    ticker: "NVDA",
    movePct: "0.1",
    windowState: "after_hours",
    minConfidence: 70,
    allowlisted: false,
  });
  console.log("provider", result.provider, "model", result.model, "path", result.path);
  console.log("decision", result.decision);
  console.log("smoke_llm_tor_ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
