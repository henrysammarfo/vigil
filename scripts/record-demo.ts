#!/usr/bin/env bun
/**
 * Story-synced demo capture for Stampit submit.
 * Records Playwright video + beat markers aligned to docs/submission/DEMO_SCRIPT.md
 *
 * Usage: bun scripts/record-demo.ts
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.VIGIL_BASE_URL?.trim() || "https://vigil-one-wine.vercel.app").replace(
  /\/$/,
  "",
);
const OUT = join(process.cwd(), "docs", "submission", "artifacts");
const VIDEO_DIR = join(OUT, "raw-video");

type Beat = { id: string; atMs: number; note: string };
const beats: Beat[] = [];
const t0 = Date.now();

function mark(id: string, note: string) {
  const atMs = Date.now() - t0;
  beats.push({ id, atMs, note });
  console.log(`BEAT ${id} @${(atMs / 1000).toFixed(1)}s · ${note}`);
}

async function wait(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function dismissCookie(page: Page) {
  const accept = page.getByRole("button", { name: /^accept$/i });
  if (await accept.count()) await accept.click().catch(() => undefined);
}

async function ensureWorkspace(page: Page) {
  const email = `vigil-demo-${Date.now()}@example.com`;
  const pass = "VigilDemoSubmit26!";
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await dismissCookie(page);
  const toggle = page.getByRole("button", { name: /need a workspace|register/i });
  if (await toggle.count()) await toggle.first().click();
  await wait(400);
  const nameBox = page.locator('input:not([type="email"]):not([type="password"]):not([type="hidden"])').first();
  if (await nameBox.count()) await nameBox.fill("VIGIL Demo");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.locator("form").evaluate((f) => (f as HTMLFormElement).requestSubmit());
  await wait(5000);
  if (!page.url().includes("dashboard")) {
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(pass);
    await page.getByRole("button", { name: /enter dashboard|sign in/i }).click();
    await wait(4000);
  }
  return email;
}

async function main() {
  mkdirSync(VIDEO_DIR, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.VIGIL_BROWSER_CHANNEL?.trim() || "chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept().catch(() => undefined));

  // BEAT 01 — Hook
  mark("01-hook", "landing");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await dismissCookie(page);
  await wait(3500);
  await page.mouse.wheel(0, 400);
  await wait(2500);
  await page.mouse.wheel(0, 500);
  await wait(4000);

  // BEAT 02 — Problem / system
  mark("02-problem", "how-it-works");
  await page.goto(`${BASE}/how-it-works`, { waitUntil: "domcontentloaded" });
  await wait(4000);
  await page.mouse.wheel(0, 600);
  await wait(4000);
  await page.mouse.wheel(0, 500);
  await wait(4000);

  // BEAT 03 — Product / brand
  mark("03-product", "brand + journal");
  await page.goto(`${BASE}/brand`, { waitUntil: "domcontentloaded" });
  await wait(3500);
  await page.goto(`${BASE}/journal`, { waitUntil: "domcontentloaded" });
  await wait(4500);

  // BEAT 04 — Live desk
  mark("04-live", "register + dashboard tour");
  await ensureWorkspace(page);
  await wait(2000);

  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await wait(4500);
  await page.goto(`${BASE}/dashboard/signals`, { waitUntil: "domcontentloaded" });
  await wait(3500);
  await page.goto(`${BASE}/dashboard/journal`, { waitUntil: "domcontentloaded" });
  await wait(4000);
  await page.goto(`${BASE}/dashboard/terminal`, { waitUntil: "domcontentloaded" });
  await wait(5000);
  const backtest = page.getByRole("button", { name: /backtest/i });
  if ((await backtest.count()) > 0 && (await backtest.first().isEnabled())) {
    await backtest.first().click().catch(() => undefined);
    await wait(8000);
  } else {
    await wait(3000);
  }
  await page.goto(`${BASE}/dashboard/trades`, { waitUntil: "domcontentloaded" });
  await wait(4000);

  // BEAT 05 — Close
  mark("05-close", "settings + end");
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded" });
  await wait(4500);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await wait(4000);

  writeFileSync(join(OUT, "demo-beats.json"), JSON.stringify({ base: BASE, beats, t0 }, null, 2));

  await context.close();
  await browser.close();

  // Playwright writes webm into VIDEO_DIR with random name — promote newest
  const files = readdirSync(VIDEO_DIR).filter((f) => f.endsWith(".webm"));
  if (!files.length) throw new Error("No webm recorded");
  const newest = files
    .map((f) => ({ f, t: existsSync(join(VIDEO_DIR, f)) ? Bun.file(join(VIDEO_DIR, f)).size : 0 }))
    .sort((a, b) => b.t - a.t)[0]!.f;
  const dest = join(OUT, "vigil-s2-demo-raw.webm");
  copyFileSync(join(VIDEO_DIR, newest), dest);
  console.log("RAW_VIDEO", dest);
  console.log("BEATS", join(OUT, "demo-beats.json"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
