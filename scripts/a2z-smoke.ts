#!/usr/bin/env bun
/**
 * A–Z production smoke for VIGIL (live Vercel).
 * Usage: bun scripts/a2z-smoke.ts
 * Env: VIGIL_BASE_URL, VIGIL_OWNER_EMAIL, VIGIL_OWNER_PASSWORD (optional for auth path)
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = (process.env.VIGIL_BASE_URL?.trim() || "https://vigil-one-wine.vercel.app").replace(
  /\/$/,
  "",
);
const EMAIL = process.env.VIGIL_OWNER_EMAIL?.trim() || process.env.VIGIL_DEMO_EMAIL?.trim() || "";
const PASS = process.env.VIGIL_OWNER_PASSWORD || process.env.VIGIL_DEMO_PASSWORD || "";
const OUT =
  process.env.VIGIL_A2Z_OUT?.trim() ||
  (process.platform === "win32"
    ? join(homedir(), ".cursor", "artifacts", "a2z-smoke")
    : "/opt/cursor/artifacts/a2z-smoke");

type Check = { id: string; ok: boolean; detail: string };
const checks: Check[] = [];

function pass(id: string, detail: string) {
  checks.push({ id, ok: true, detail });
  console.log(`PASS  ${id}  · ${detail}`);
}
function fail(id: string, detail: string) {
  checks.push({ id, ok: false, detail });
  console.log(`FAIL  ${id}  · ${detail}`);
}

async function httpGet(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    ...init,
  });
  return res;
}

async function checkPublicPages() {
  const paths = [
    "/",
    "/auth",
    "/how-it-works",
    "/journal",
    "/privacy",
    "/terms",
    "/contact",
    "/about",
  ];
  for (const p of paths) {
    const res = await httpGet(p);
    if (res.status === 200) pass(`public${p === "/" ? "/home" : p}`, `HTTP ${res.status}`);
    else fail(`public${p === "/" ? "/home" : p}`, `HTTP ${res.status}`);
  }
}

async function checkSecurityHeaders() {
  const res = await httpGet("/");
  const hsts = res.headers.get("strict-transport-security") || "";
  const frame = res.headers.get("x-frame-options") || "";
  const nosniff = res.headers.get("x-content-type-options") || "";
  const perms = res.headers.get("permissions-policy") || "";
  if (/preload/i.test(hsts)) pass("hdr-hsts", hsts.slice(0, 80));
  else fail("hdr-hsts", hsts || "missing");
  if (/deny/i.test(frame)) pass("hdr-xfo", frame);
  else fail("hdr-xfo", frame || "missing");
  if (/nosniff/i.test(nosniff)) pass("hdr-nosniff", nosniff);
  else fail("hdr-nosniff", nosniff || "missing");
  if (perms.length > 0) pass("hdr-permissions", perms.slice(0, 80));
  else fail("hdr-permissions", "missing");
}

async function checkAuthGate() {
  for (const p of ["/dashboard", "/dashboard/settings", "/dashboard/chat"]) {
    const res = await httpGet(p);
    const loc = res.headers.get("location") || "";
    if ([301, 302, 303, 307, 308].includes(res.status) && /auth/i.test(loc)) {
      pass(`gate${p}`, `${res.status} → ${loc}`);
    } else if (res.status === 200) {
      fail(`gate${p}`, `HTTP 200 (expected redirect)`);
    } else {
      fail(`gate${p}`, `HTTP ${res.status} loc=${loc}`);
    }
  }
}

async function checkAgentRouterSurface() {
  try {
    const res = await fetch("https://api.agentrouter.org/v1/models", {
      headers: { Authorization: "Bearer dummy" },
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();
    const isHtml = /aliyun_waf|captcha|<html/i.test(text);
    if (isHtml) pass("agentrouter-direct-waf", `WAF HTML status=${res.status}`);
    else pass("agentrouter-direct-json", `status=${res.status} len=${text.length}`);
  } catch (e) {
    fail("agentrouter-direct", e instanceof Error ? e.message : String(e));
  }
}

async function loginOwner(page: Page) {
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const toggle = page.getByRole("button", {
    name: /need a workspace|already registered|register|sign in/i,
  });
  if (await toggle.count()) {
    const t = await toggle.innerText();
    if (/need a workspace|register/i.test(t) === false) {
      // already on register — switch to login
    } else if (/already registered|sign in/i.test(t)) {
      await toggle.click();
    }
  }
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.getByRole("button", { name: /enter dashboard|sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
}

async function checkAuthenticated(page: Page) {
  const dashPaths = [
    "/dashboard",
    "/dashboard/signals",
    "/dashboard/trades",
    "/dashboard/terminal",
    "/dashboard/journal",
    "/dashboard/replay",
    "/dashboard/settings",
    "/dashboard/chat",
  ];
  for (const p of dashPaths) {
    const res = await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(600);
    const status = res?.status() ?? 0;
    const body = (await page.locator("body").innerText().catch(() => "")).trim();
    const id = `auth${p === "/dashboard" ? "/overview" : p.replace("/dashboard", "")}`;
    if (status === 200 && body.length > 20 && !/sign in|enter dashboard/i.test(body.slice(0, 80))) {
      pass(id, `HTTP ${status} · ${body.slice(0, 40).replace(/\s+/g, " ")}`);
    } else {
      fail(id, `HTTP ${status} · ${body.slice(0, 60).replace(/\s+/g, " ")}`);
    }
  }

  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const overview = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (/\$100|100/.test(overview) && /5000|\$5,?000/.test(overview)) {
    pass("growth-book", "equity/target visible");
  } else {
    fail("growth-book", overview.slice(0, 120));
  }
  const run = page.getByRole("button", { name: /run agent/i });
  if ((await run.count()) > 0) pass("run-agent-btn", (await run.isEnabled()) ? "enabled" : "disabled");
  else fail("run-agent-btn", "missing");

  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const settings = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (/connected|bitget/i.test(settings)) pass("bitget-vault", "Bitget UI present");
  else fail("bitget-vault", settings.slice(0, 100));
  if (/NVDA|AMD|AAPL|TSLA/i.test(settings)) pass("allowlist", "growth tickers visible");
  else fail("allowlist", "tickers not found");
  if (/FENN|paper/i.test(settings)) pass("fenn-paper", "FENN/paper controls visible");
  else fail("fenn-paper", "controls not found");

  await page.goto(`${BASE}/dashboard/chat`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const chat = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (/thread|desk|chat|daily|cap|\/growth/i.test(chat) || (await page.locator("textarea, [contenteditable]").count()) > 0) {
    pass("desk-chat", "chat UI loaded");
  } else {
    fail("desk-chat", chat.slice(0, 100));
  }

  await page.screenshot({ path: join(OUT, "dashboard-overview.png"), fullPage: true }).catch(() => undefined);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log("BASE", BASE);
  console.log("OUT", OUT);

  await checkPublicPages();
  await checkSecurityHeaders();
  await checkAuthGate();
  await checkAgentRouterSurface();

  if (!EMAIL || !PASS) {
    fail("owner-login", "VIGIL_OWNER_EMAIL / VIGIL_OWNER_PASSWORD not set — auth path skipped");
  } else {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("dialog", (d) => d.accept().catch(() => undefined));
    try {
      await loginOwner(page);
      pass("owner-login", EMAIL);
      await checkAuthenticated(page);
    } catch (e) {
      fail("owner-login", e instanceof Error ? e.message : String(e));
    } finally {
      await browser.close();
    }
  }

  const passN = checks.filter((c) => c.ok).length;
  const failN = checks.filter((c) => !c.ok).length;
  const summary = {
    base: BASE,
    at: new Date().toISOString(),
    pass: passN,
    fail: failN,
    total: checks.length,
    checks,
  };
  writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY pass=${passN} fail=${failN} total=${checks.length}`);
  if (failN > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
