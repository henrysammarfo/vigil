#!/usr/bin/env bun
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts/walkthrough";
const EMAIL = "vigil-live-s2@example.com";
const PASS = "VigilDemo2026!";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("dialog", (d) => d.accept().catch(() => undefined));

  async function shot(name: string) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log("ok", name, page.url());
  }

  const pubs: Array<[string, string]> = [
    ["01_home", "/"],
    ["02_how", "/how-it-works"],
    ["03_journal_pub", "/journal"],
    ["04_about", "/about"],
    ["05_brand", "/brand"],
    ["06_contact", "/contact"],
  ];
  for (const [n, p] of pubs) {
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await shot(n);
  }

  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.getByRole("button", { name: /enter dashboard|sign in/i }).click();
  await page.waitForTimeout(4000);
  if (!page.url().includes("dashboard")) {
    await page.getByRole("button", { name: /need a workspace|register/i }).click();
    await page.waitForTimeout(300);
    await page.locator("input").nth(0).fill("Demo Live");
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASS);
    await page.getByRole("button", { name: /create|enter/i }).click();
    await page.waitForTimeout(5000);
  }
  if (!page.url().includes("dashboard")) throw new Error("auth failed: "+page.url());
  await shot("07_overview");

  const dash: Array<[string, string]> = [
    ["08_signals", "/dashboard/signals"],
    ["09_trades", "/dashboard/trades"],
    ["10_terminal", "/dashboard/terminal"],
    ["11_whylog", "/dashboard/journal"],
    ["12_replay", "/dashboard/replay"],
    ["13_settings", "/dashboard/settings"],
  ];
  for (const [n, p] of dash) {
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await shot(n);
  }

  // Settings save allowlist with AMD
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const al = page.getByPlaceholder(/e\.g\. NVDA|NVDA/i);
  if ((await al.count()) > 0) {
    await al.fill("AMD, NVDA, AAPL, TSLA");
  }
  const save = page.getByRole("button", { name: /save/i });
  if ((await save.count()) > 0) await save.first().click();
  await page.waitForTimeout(1500);
  await shot("14_settings_amd");

  // Terminal + backtest
  await page.goto(`${BASE}/dashboard/terminal`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const selects = page.locator("select");
  if ((await selects.count()) > 0) {
    await selects.first().selectOption({ value: "AMDUSDT" }).catch(async () => {
      await selects.first().selectOption({ label: /AMD/i }).catch(() => undefined);
    });
  }
  await shot("15_terminal_amd");
  const bt = page.getByRole("button", { name: /backtest|walk-forward|run lab|run/i });
  const nBt = await bt.count();
  console.log("backtest buttons", nBt);
  if (nBt > 0) {
    await bt.first().click();
    await page.waitForTimeout(15_000);
    await shot("16_terminal_backtest");
  }

  // Trades mark
  await page.goto(`${BASE}/dashboard/trades`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const mark = page.getByRole("button", { name: /mark open/i });
  if ((await mark.count()) > 0) await mark.click();
  await page.waitForTimeout(2000);
  await shot("17_trades_bankroll");

  // Why-log + replay clicks
  await page.goto(`${BASE}/dashboard/journal`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await shot("18_whylog");

  await page.goto(`${BASE}/dashboard/replay`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const play = page.getByRole("button", { name: /play|replay|step|load/i });
  if ((await play.count()) > 0) await play.first().click().catch(() => undefined);
  await page.waitForTimeout(1200);
  await shot("19_replay");

  // Overview run agent (after hours should be active)
  await page.goto(`${BASE}/dashboard/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const run = page.getByRole("button", { name: /run agent/i });
  if ((await run.count()) > 0 && !(await run.isDisabled())) {
    await run.click();
    console.log("clicked run agent");
    await page.waitForTimeout(45_000);
    await shot("20_overview_after_run");
  } else {
    console.log("run agent skipped/disabled");
    await shot("20_overview_standby");
  }

  await browser.close();
  console.log("DONE", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
