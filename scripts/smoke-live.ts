#!/usr/bin/env bun
/**
 * Smoke: TinyFish Search (live) + closed-window unit path.
 * Does not invent news. Exits non-zero if TinyFish key missing or search fails.
 */
import { evaluateClosedWindow } from "../src/vigil/agent/closed-window";

async function main() {
  const window = evaluateClosedWindow();
  console.log("window", window.state, window.allowed);

  const key = process.env.TINYFISH_API_KEY?.trim();
  if (!key) {
    console.error("TINYFISH_API_KEY missing — smoke requires live search");
    process.exit(1);
  }
  const url = new URL("https://api.search.tinyfish.ai");
  url.searchParams.set("query", "US stock after-hours news");
  url.searchParams.set("domain_type", "news");
  const res = await fetch(url, { headers: { "X-API-Key": key } });
  if (!res.ok) {
    console.error("TinyFish smoke failed", res.status, await res.text());
    process.exit(1);
  }
  const data = (await res.json()) as { results?: unknown[] };
  console.log("tinyfish_results", data.results?.length ?? 0);
  console.log("smoke_ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
