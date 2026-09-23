#!/usr/bin/env bun
/**
 * Click-through smoke: every public + dashboard page and interactive control.
 * Does NOT click Run agent (live news/LLM/Bitget — already proven separately).
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.VIGIL_BASE_URL?.trim() || "http://127.0.0.1:3000";
const EMAIL = process.env.VIGIL_DEMO_EMAIL?.trim() || "vigil-demo-s2@example.com";
const PASS = process.env.VIGIL_DEMO_PASSWORD?.trim() || "VigilDemo2026!";

type Row = { path: string; ok: boolean; clicked: string[]; notes: string };
const rows: Row[] = [];

function record(path: string, ok: boolean, clicked: string[], notes: string) {
  rows.push({ path, ok, clicked, notes });
  console.log(`${ok ? "PASS" : "FAIL"}  ${path}  · ${clicked.join(", ") || "—"}  · ${notes}`);
}

async function goto(page: Page, path: string) {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(800);
  return res;
}

async function clickLink(page: Page, name: RegExp | string) {
  const link = page.getByRole("link", { name }).first();
  await link.waitFor({ state: "visible", timeout: 15_000 });
  await link.click();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", async (d) => {
    await d.accept().catch(() => undefined);
  });

  try {
    // —— Public ——
    await goto(page, "/");
    await clickLink(page, /open the vigil/i);
    await page.waitForURL(/auth|dashboard/, { timeout: 15_000 });
    record("/", true, ["Open the vigil"], page.url());

    await goto(page, "/");
    await clickLink(page, /trace the system/i);
    await page.waitForURL(/how-it-works/, { timeout: 15_000 });
    record("/#trace", true, ["Trace the system"], page.url());

    await goto(page, "/how-it-works");
    await clickLink(page, /replay|watch|dashboard|open/i).catch(async () => {
      // try any primary button-as-link on page
      await page.locator('a[href*="replay"], a[href*="dashboard"]').first().click();
    });
    await page.waitForTimeout(500);
    record("/how-it-works", true, ["primary CTA"], page.url());

    for (const p of ["/about", "/brand", "/journal"] as const) {
      const res = await goto(page, p);
      await page.waitForTimeout(1200);
      const status = res?.status() ?? 0;
      const body = (await page.locator("body").innerText().catch(() => "")).trim();
      record(
        p,
        status === 200 && body.length > 40,
        ["load"],
        `HTTP ${status} · ${body.slice(0, 48).replace(/\s+/g, " ")}`,
      );
    }

    await goto(page, "/contact");
    await page.locator("form,input,textarea").first().waitFor({ timeout: 15_000 });
    const inputs = page.locator("input");
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const el = inputs.nth(i);
      const type = (await el.getAttribute("type")) || "text";
      if (type === "email") await el.fill("smoke@example.com");
      else if (type !== "submit" && type !== "hidden") await el.fill("UI Smoke");
    }
    if (await page.locator("textarea").count()) {
      await page.locator("textarea").first().fill("Playwright smoke contact — ignore.");
    }
    await page.getByRole("button", { name: /send|submit|signal/i }).click();
    await page.waitForTimeout(1000);
    const sent = await page.getByText(/signal received|sent|thanks|received/i).count();
    record("/contact", sent > 0, ["Submit"], sent ? "sent OK" : "no confirmation");

    await goto(page, "/auth");
    // ensure login mode
    const toggle = page.getByRole("button", { name: /need a workspace|already registered|register|sign in/i });
    if (await toggle.count()) {
      const t = await toggle.innerText();
      if (/need a workspace|register/i.test(t) === false) {
        // currently on register → switch to login
        await toggle.click();
      }
    }
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASS);
    await page.getByRole("button", { name: /enter dashboard|sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 20_000 });
    record("/auth", true, ["Sign in"], page.url());

    // —— Dashboard nav ——
    const navItems: Array<[string, RegExp]> = [
      ["/dashboard", /^overview$/i],
      ["/dashboard/signals", /^signals$/i],
      ["/dashboard/trades", /paper trades/i],
      ["/dashboard/journal", /why-log/i],
      ["/dashboard/replay", /^replay$/i],
      ["/dashboard/settings", /^settings$/i],
    ];
    for (const [path, label] of navItems) {
      await page.locator("aside nav").getByRole("link", { name: label }).click();
      await page.waitForTimeout(500);
      const ok = page.url().includes(path);
      record(path, ok, [`nav:${label}`], page.url());
    }

    // Overview — Run agent present
    await goto(page, "/dashboard/");
    const runBtn = page.getByRole("button", { name: /run agent/i });
    const runVisible = (await runBtn.count()) > 0 && (await runBtn.isEnabled());
    record("/dashboard#run-agent", runVisible, ["Run agent visible"], "not clicked (already proven live)");

    // Signals
    await goto(page, "/dashboard/signals");
    await page.getByPlaceholder(/search/i).fill("NVDA");
    await page.waitForTimeout(200);
    if (await page.getByRole("button", { name: /filter/i }).count()) {
      await page.getByRole("button", { name: /filter/i }).click();
    }
    record("/dashboard/signals#controls", true, ["Search", "Filter"], "ok");

    // Trades export
    await goto(page, "/dashboard/trades");
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 12_000 }).catch(() => null),
      page.getByRole("button", { name: /export/i }).click(),
    ]);
    record(
      "/dashboard/trades#export",
      Boolean(download),
      ["Export"],
      download ? `file=${download.suggestedFilename()}` : "no download",
    );

    // Why-log
    await goto(page, "/dashboard/journal");
    const entry = page.locator("button").filter({ hasText: /PAPER_|NO_TRADE|WATCH/i }).first();
    if (await entry.count()) {
      await entry.click();
      await page.getByRole("button", { name: /copy hash/i }).click();
      record("/dashboard/journal#entry", true, ["select entry", "Copy hash"], "ok");
    } else {
      record("/dashboard/journal#entry", false, [], "no why-cards");
    }

    // Replay
    await goto(page, "/dashboard/replay");
    await page.getByRole("button", { name: /^play$/i }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: /^reset$/i }).click();
    record("/dashboard/replay", true, ["Play", "Reset"], "ok");

    // Settings save
    await goto(page, "/dashboard/settings");
    await page.getByRole("button", { name: /save settings/i }).click();
    await page.waitForTimeout(800);
    const saved = await page.getByText(/saved/i).count();
    record("/dashboard/settings#save", saved > 0, ["Save settings"], saved ? "Saved" : "no Saved");

    // Header icons
    await page.getByRole("button", { name: /notifications/i }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: /account/i }).click();
    await page.waitForURL(/settings/, { timeout: 10_000 });
    record("/dashboard#header-icons", true, ["Notifications", "Account→settings"], page.url());

    // Logout (header icon only — avoid any duplicate accessible names)
    await page.getByLabel("Sign out").click();
    await page.waitForURL(/auth/, { timeout: 10_000 });
    record("/logout", page.url().includes("/auth"), ["Sign out"], page.url());

    mkdirSync("/opt/cursor/artifacts", { recursive: true });
    // Best-effort final screenshot (functional checklist already complete)
    try {
      await page.locator('input[type="email"]').fill(EMAIL);
      await page.locator('input[type="password"]').fill(PASS);
      await page.getByRole("button", { name: /enter dashboard|sign in/i }).click();
      await page.waitForURL(/dashboard/, { timeout: 15_000 });
      await page.screenshot({
        path: "/opt/cursor/artifacts/vigil-ui-smoke-final.png",
        fullPage: true,
      });
    } catch (e) {
      console.warn("final screenshot skipped:", e instanceof Error ? e.message : e);
      await page.screenshot({
        path: "/opt/cursor/artifacts/vigil-ui-smoke-final.png",
        fullPage: true,
      });
    }
  } finally {
    await browser.close();
  }

  const fails = rows.filter((r) => !r.ok);
  const out = {
    base: BASE,
    at: new Date().toISOString(),
    pageErrors: errors.slice(0, 20),
    rows,
    failCount: fails.length,
    verdict: fails.length === 0 ? "ALL_PASS" : "HAS_FAILURES",
  };
  writeFileSync("/opt/cursor/artifacts/vigil-ui-smoke.json", JSON.stringify(out, null, 2));
  console.log("\nVERDICT", out.verdict, `fails=${fails.length}`, `pageErrors=${errors.length}`);
  if (fails.length) {
    for (const f of fails) console.log(" -", f.path, f.notes);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
