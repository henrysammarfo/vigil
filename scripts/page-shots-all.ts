#!/usr/bin/env bun
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts/page-shots";
const EMAIL = "vigil-demo-s2@example.com";
const PASS = "VigilDemo2026!";
mkdirSync(OUT, { recursive: true });

const publicPages = [
  ["01-home", "/"],
  ["02-how-it-works", "/how-it-works"],
  ["03-journal", "/journal"],
  ["04-about", "/about"],
  ["05-brand", "/brand"],
  ["06-contact", "/contact"],
  ["07-auth", "/auth"],
] as const;

const dashPages = [
  ["08-dashboard-overview", "/dashboard/"],
  ["09-dashboard-signals", "/dashboard/signals"],
  ["10-dashboard-trades", "/dashboard/trades"],
  ["11-dashboard-journal", "/dashboard/journal"],
  ["12-dashboard-replay", "/dashboard/replay"],
  ["13-dashboard-settings", "/dashboard/settings"],
] as const;

async function shot(page: import("playwright").Page, name: string) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("ok", name);
}

async function login(page: import("playwright").Page) {
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(500);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.getByRole("button", { name: /enter dashboard|sign in/i }).click();
  await page.waitForTimeout(3000);
  if (!page.url().includes("dashboard")) {
    await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    await page.getByRole("button", { name: /enter dashboard|sign in/i }).click();
    await page.waitForTimeout(4000);
  }
  console.log("logged", page.url());
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  desk.on("dialog", (d) => d.accept().catch(() => undefined));

  for (const [name, path] of publicPages) {
    await desk.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await shot(desk, `desk-${name}`);
  }

  await login(desk);
  for (const [name, path] of dashPages) {
    await desk.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await shot(desk, `desk-${name}`);
  }

  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mob.on("dialog", (d) => d.accept().catch(() => undefined));
  for (const [name, path] of publicPages) {
    await mob.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await shot(mob, `mob-${name}`);
  }
  await login(mob);
  for (const [name, path] of dashPages) {
    await mob.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await shot(mob, `mob-${name}`);
  }

  await browser.close();
  console.log("DONE", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
