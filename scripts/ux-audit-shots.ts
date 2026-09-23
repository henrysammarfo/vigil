#!/usr/bin/env bun
/** Capture desktop + mobile screenshots of every VIGIL page for UX audit. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:3000";
const EMAIL = "vigil-demo-s2@example.com";
const PASS = "VigilDemo2026!";
const OUT = "/opt/cursor/artifacts/ux-audit";

mkdirSync(OUT, { recursive: true });

async function shot(page: import("playwright").Page, name: string) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("shot", name);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Desktop
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  desk.on("dialog", (d) => d.accept().catch(() => undefined));

  for (const p of ["/", "/how-it-works", "/about", "/brand", "/journal", "/contact", "/auth"]) {
    await desk.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await desk.waitForTimeout(900);
    await shot(desk, `desk${p === "/" ? "-home" : p.replace(/\//g, "-")}`);
  }

  await desk.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" });
  await desk.locator('input[type="email"]').fill(EMAIL);
  await desk.locator('input[type="password"]').fill(PASS);
  await desk.getByRole("button", { name: /enter dashboard|sign in/i }).click();
  await desk.waitForURL(/dashboard/, { timeout: 20_000 });

  for (const p of [
    "/dashboard/",
    "/dashboard/signals",
    "/dashboard/trades",
    "/dashboard/journal",
    "/dashboard/replay",
    "/dashboard/settings",
  ]) {
    await desk.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await desk.waitForTimeout(900);
    await shot(desk, `desk${p.replace(/\//g, "-").replace(/-$/, "")}`);
  }

  // Mobile
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mob.on("dialog", (d) => d.accept().catch(() => undefined));
  await mob.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await mob.waitForTimeout(900);
  await shot(mob, "mob-home");
  // open mobile menu if present
  const menu = mob.getByRole("button").filter({ has: mob.locator("svg") }).first();
  if (await mob.locator('button:has(svg)').count()) {
    // try header menu
  }
  await mob.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" });
  await mob.locator('input[type="email"]').fill(EMAIL);
  await mob.locator('input[type="password"]').fill(PASS);
  await mob.getByRole("button", { name: /enter dashboard|sign in/i }).click();
  await mob.waitForURL(/dashboard/, { timeout: 20_000 });
  await mob.waitForTimeout(800);
  await shot(mob, "mob-dashboard");
  // open mobile sidebar
  const burger = mob.getByRole("button").nth(0);
  await burger.click().catch(() => undefined);
  await mob.waitForTimeout(400);
  await shot(mob, "mob-dashboard-menu");
  await mob.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded" });
  await mob.waitForTimeout(800);
  await shot(mob, "mob-settings");
  await mob.goto(`${BASE}/dashboard/journal`, { waitUntil: "domcontentloaded" });
  await mob.waitForTimeout(800);
  await shot(mob, "mob-journal");
  await mob.goto(`${BASE}/dashboard/trades`, { waitUntil: "domcontentloaded" });
  await mob.waitForTimeout(800);
  await shot(mob, "mob-trades");

  await browser.close();
  console.log("done", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
