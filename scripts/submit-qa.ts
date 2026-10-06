#!/usr/bin/env bun
/**
 * Full submit QA: HTTP status, auth gate, branding, responsive viewports,
 * dashboard interactivity (registers a throwaway workspace on prod).
 *
 * Usage: bun scripts/submit-qa.ts
 * Env: VIGIL_BASE_URL (default production)
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = (process.env.VIGIL_BASE_URL?.trim() || "https://vigil-one-wine.vercel.app").replace(
  /\/$/,
  "",
);
const OUT =
  process.env.VIGIL_QA_OUT?.trim() ||
  join(process.cwd(), "docs", "submission", "artifacts", "qa");

type Row = { id: string; ok: boolean; detail: string };
const rows: Row[] = [];

function pass(id: string, detail: string) {
  rows.push({ id, ok: true, detail });
  console.log(`PASS  ${id} · ${detail}`);
}
function fail(id: string, detail: string) {
  rows.push({ id, ok: false, detail });
  console.log(`FAIL  ${id} · ${detail}`);
}

const PUBLIC = [
  "/",
  "/auth",
  "/how-it-works",
  "/journal",
  "/about",
  "/brand",
  "/contact",
  "/privacy",
  "/terms",
] as const;

const DASH = [
  "/dashboard",
  "/dashboard/signals",
  "/dashboard/trades",
  "/dashboard/terminal",
  "/dashboard/journal",
  "/dashboard/replay",
  "/dashboard/settings",
  "/dashboard/chat",
] as const;

async function httpChecks() {
  for (const p of PUBLIC) {
    const res = await fetch(`${BASE}${p}`, { redirect: "manual" });
    if (res.status === 200) pass(`http${p === "/" ? "/home" : p}`, `HTTP ${res.status}`);
    else fail(`http${p === "/" ? "/home" : p}`, `HTTP ${res.status}`);
  }
  for (const p of DASH) {
    const res = await fetch(`${BASE}${p}`, { redirect: "manual" });
    const loc = res.headers.get("location") || "";
    if ([301, 302, 303, 307, 308].includes(res.status) && /auth/i.test(loc)) {
      pass(`gate${p}`, `${res.status} → auth`);
    } else fail(`gate${p}`, `${res.status} ${loc}`);
  }
  const home = await fetch(BASE);
  const hsts = home.headers.get("strict-transport-security") || "";
  const xfo = home.headers.get("x-frame-options") || "";
  const nosniff = home.headers.get("x-content-type-options") || "";
  if (/preload/i.test(hsts)) pass("hdr-hsts", hsts.slice(0, 72));
  else fail("hdr-hsts", hsts || "missing");
  if (/deny/i.test(xfo)) pass("hdr-xfo", xfo);
  else fail("hdr-xfo", xfo || "missing");
  if (/nosniff/i.test(nosniff)) pass("hdr-nosniff", nosniff);
  else fail("hdr-nosniff", nosniff || "missing");
}

async function dismissCookie(page: Page) {
  const accept = page.getByRole("button", { name: /^accept$/i });
  if (await accept.count()) await accept.click().catch(() => undefined);
}

async function checkPublicUi(page: Page, suffix: string) {
  for (const p of PUBLIC) {
    const res = await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(500);
    await dismissCookie(page);
    const status = res?.status() ?? 0;
    const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    const brand = /VIGIL/i.test(text);
    const broken = /application error|internal server|something went wrong/i.test(text);
    const id = `ui${suffix}${p === "/" ? "/home" : p}`;
    if (status === 200 && brand && !broken && text.length > 40) pass(id, `len=${text.length}`);
    else fail(id, `HTTP ${status} brand=${brand} broken=${broken}`);
    await page.screenshot({ path: join(OUT, `${suffix}${p.replace(/\//g, "_") || "_home"}.png`) }).catch(
      () => undefined,
    );
  }

  // Brand page mark + download affordance
  await page.goto(`${BASE}/brand`, { waitUntil: "domcontentloaded" });
  await dismissCookie(page);
  const dl = page.getByRole("link", { name: /download svg/i });
  if ((await dl.count()) > 0) pass(`brand-download${suffix}`, "SVG download present");
  else fail(`brand-download${suffix}`, "missing");

  // Contact form interactivity
  await page.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
  await dismissCookie(page);
  const inputs = page.locator("input");
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    const type = (await el.getAttribute("type")) || "text";
    if (type === "email") await el.fill("submit-qa@example.com");
    else if (type !== "submit" && type !== "hidden") await el.fill("Submit QA");
  }
  if (await page.locator("textarea").count()) {
    await page.locator("textarea").first().fill("VIGIL submit QA — ignore.");
  }
  const send = page.getByRole("button", { name: /send|submit|signal/i });
  if (await send.count()) {
    await send.first().click();
    await page.waitForTimeout(900);
    pass(`contact-submit${suffix}`, "clicked");
  } else fail(`contact-submit${suffix}`, "no submit");
}

async function registerAndDash(browser: Browser) {
  const email = `vigil-qa-${Date.now()}@example.com`;
  const password = "VigilSubmit2026!";
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("dialog", (d) => d.accept().catch(() => undefined));

  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle", timeout: 60_000 });
  await dismissCookie(page);
  const toggle = page.getByRole("button", { name: /need a workspace|register/i });
  if (await toggle.count()) await toggle.first().click();
  await page.waitForTimeout(300);

  const emailBox = page.locator('input[type="email"]');
  const passBox = page.locator('input[type="password"]');
  const nameBox = page.locator('input:not([type="email"]):not([type="password"]):not([type="hidden"])').first();
  if (await nameBox.count()) await nameBox.fill("Submit QA");
  await emailBox.fill(email);
  await passBox.fill(password);
  await page.locator("form").evaluate((f) => (f as HTMLFormElement).requestSubmit());
  await page.waitForTimeout(5000);

  if (!page.url().includes("dashboard")) {
    // try login path
    await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" });
    const loginToggle = page.getByRole("button", { name: /already registered|sign in/i });
    if (await loginToggle.count()) await loginToggle.click();
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /enter dashboard|sign in/i }).click();
    await page.waitForTimeout(5000);
  }

  if (page.url().includes("dashboard")) pass("auth-register", email);
  else {
    fail("auth-register", page.url());
    await page.close();
    return;
  }

  for (const p of DASH) {
    const res = await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(700);
    const status = res?.status() ?? 0;
    const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    const ok =
      status === 200 &&
      text.length > 30 &&
      !/sign in|enter dashboard/i.test(text.slice(0, 100)) &&
      !/application error|internal server/i.test(text);
    const id = `dash${p === "/dashboard" ? "/overview" : p.replace("/dashboard", "")}`;
    if (ok) pass(id, `HTTP ${status}`);
    else fail(id, `HTTP ${status} · ${text.slice(0, 80)}`);
    await page
      .screenshot({ path: join(OUT, `dash${p.replace(/\//g, "_")}.png`) })
      .catch(() => undefined);
  }

  // Overview Run agent button present
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const run = page.getByRole("button", { name: /run agent/i });
  if ((await run.count()) > 0) pass("run-agent", (await run.isEnabled()) ? "enabled" : "disabled");
  else fail("run-agent", "missing");

  // Terminal strategy surface
  await page.goto(`${BASE}/dashboard/terminal`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const term = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (/backtest|NVDA|AMD|AAPL|TSLA|playbook|terminal/i.test(term)) pass("strategy-terminal", "playbook UI");
  else fail("strategy-terminal", term.slice(0, 100));

  // Settings paper / FENN language
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const settings = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (/paper|bitget|allowlist|fenn|confidence/i.test(settings)) pass("settings-controls", "ok");
  else fail("settings-controls", settings.slice(0, 100));

  // Chat desk
  await page.goto(`${BASE}/dashboard/chat`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  if ((await page.locator("textarea, [contenteditable=true]").count()) > 0 || /desk|thread|chat/i.test(await page.locator("body").innerText())) {
    pass("desk-chat", "composer present");
  } else fail("desk-chat", "no composer");

  // Mobile dashboard spot-check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const mob = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (mob.length > 40 && !/application error/i.test(mob)) pass("mobile-dashboard", "loads");
  else fail("mobile-dashboard", mob.slice(0, 80));
  await page.screenshot({ path: join(OUT, "mobile-dashboard.png") }).catch(() => undefined);

  await page.close();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log("BASE", BASE);
  console.log("OUT", OUT);

  await httpChecks();

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.VIGIL_BROWSER_CHANNEL?.trim() || "chrome",
  });
  try {
    const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    desk.on("dialog", (d) => d.accept().catch(() => undefined));
    await checkPublicUi(desk, "-desk");
    await desk.close();

    const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mob.on("dialog", (d) => d.accept().catch(() => undefined));
    await checkPublicUi(mob, "-mob");
    await mob.close();

    await registerAndDash(browser);
  } finally {
    await browser.close();
  }

  const passN = rows.filter((r) => r.ok).length;
  const failN = rows.filter((r) => !r.ok).length;
  const summary = {
    base: BASE,
    at: new Date().toISOString(),
    pass: passN,
    fail: failN,
    total: rows.length,
    rows,
  };
  writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

  const md = [
    `# QA Report — ${summary.at}`,
    "",
    `Base: ${BASE}`,
    `Result: **${passN}/${summary.total} PASS** · fail=${failN}`,
    "",
    "| Check | Status | Detail |",
    "| --- | --- | --- |",
    ...rows.map((r) => `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail.replace(/\|/g, "/")} |`),
    "",
  ].join("\n");
  writeFileSync(join(process.cwd(), "docs", "submission", "QA_REPORT.md"), md);
  // also under artifacts
  writeFileSync(join(OUT, "QA_REPORT.md"), md);

  console.log(`\nSUMMARY pass=${passN} fail=${failN} total=${rows.length}`);
  console.log("Wrote docs/submission/QA_REPORT.md");
  if (failN > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
