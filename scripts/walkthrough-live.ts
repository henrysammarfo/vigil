#!/usr/bin/env bun
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts/walkthrough";
mkdirSync(OUT, { recursive: true });

const EMAIL = `vigil-e2e-${Date.now()}@example.com`;
const PASS = "VigilDemo2026!";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("dialog", (d) => d.accept().catch(() => undefined));

  async function shot(name: string) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log("ok", name, page.url());
  }

  for (const [n, p] of [
    ["01_home", "/"],
    ["02_how", "/how-it-works"],
    ["03_journal_pub", "/journal"],
    ["04_about", "/about"],
    ["05_brand", "/brand"],
    ["06_contact", "/contact"],
  ] as const) {
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await shot(n);
  }

  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByText(/need a workspace/i).click();
  await page.waitForTimeout(400);
  await page.locator("input").nth(0).fill("E2E Bankroll");
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.locator("form").evaluate((f) => (f as HTMLFormElement).requestSubmit());
  await page.waitForTimeout(5000);
  console.log("auth ->", page.url(), EMAIL);
  if (!page.url().includes("dashboard")) {
    console.log("err", await page.locator(".text-destructive").allTextContents());
    throw new Error("auth failed");
  }
  await shot("07_overview");

  for (const [n, p] of [
    ["08_signals", "/dashboard/signals"],
    ["09_trades", "/dashboard/trades"],
    ["10_terminal", "/dashboard/terminal"],
    ["11_whylog", "/dashboard/journal"],
    ["12_replay", "/dashboard/replay"],
    ["13_settings", "/dashboard/settings"],
  ] as const) {
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await shot(n);
  }

  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const al = page.getByPlaceholder(/NVDA/i);
  if ((await al.count()) > 0) {
    await al.fill("AMD, NVDA, AAPL, TSLA");
    const save = page.getByRole("button", { name: /save/i });
    if ((await save.count()) > 0) await save.first().click();
    await page.waitForTimeout(1500);
  }
  await shot("14_settings_amd");

  await page.goto(`${BASE}/dashboard/terminal`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const sel = page.locator("select").first();
  if ((await sel.count()) > 0) {
    await sel.selectOption("AMDUSDT").catch(() => undefined);
  }
  await shot("15_terminal_amd");
  console.log("buttons", await page.getByRole("button").allTextContents());
  const bt = page.getByRole("button", { name: /backtest/i });
  if ((await bt.count()) > 0) {
    await bt.first().click();
    await page.waitForTimeout(18_000);
  }
  await shot("16_terminal_backtest");

  await page.goto(`${BASE}/dashboard/trades`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const mark = page.getByRole("button", { name: /mark open/i });
  if ((await mark.count()) > 0) await mark.click();
  await page.waitForTimeout(2000);
  await shot("17_trades_100");

  await page.goto(`${BASE}/dashboard/journal`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await shot("18_whylog");

  await page.goto(`${BASE}/dashboard/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const run = page.getByRole("button", { name: /run agent/i });
  if ((await run.count()) > 0 && !(await run.isDisabled())) {
    await run.click();
    console.log("run agent clicked");
    await page.waitForTimeout(50_000);
  }
  await shot("19_overview_run");

  await browser.close();
  console.log("DONE", OUT, EMAIL);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
