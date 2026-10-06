## 2026-10-06 — Stampit submit pack + demo pipeline

- Built judge pack: `docs/submission/STAMPIT_PACK.md`, `DEMO_SCRIPT.md`, `X_POST.md`, `README.md`.
- QA: `bun run submit:qa` → **56/56 PASS** (`docs/submission/QA_REPORT.md`).
- Demo: Playwright computer-use recorder + Edge neural VO + ffmpeg → `docs/submission/artifacts/vigil-s2-demo.mp4` (~69s, 1080p).
- Story: closed-window → FENN refuse → one Demo paper → why-log. Paper only.
- Henry still needs: post X draft + paste form if Stampit still open (deadline was 27 Sep; judge window ~07 Oct).

## 2026-10-03 — A–Z health check landed

- Added `docs/memory/HEALTH_A2Z.md` + `scripts/a2z-smoke.ts` (`bun run smoke:a2z`).
- Live product path was **32/32 PASS** on https://vigil-one-wine.vercel.app (`main` @ `63c9418`).
- Gaps remain ops-only: LLM declared in Settings, `VIGIL_LLM_RELAY_URL` for Desk on Vercel, Henry X/form.

## 2026-09-24 — Finalize to main

- Merged desk chat + bible Social pain + Neon/owner/Bitget vault to `main`.
- Prod: https://vigil-one-wine.vercel.app · PR #3.
- Remaining Henry: X post + Google Form. Remaining ops: Tor/relay for Desk LLM on Vercel.

## 2026-09-24 — VIGIL_BIBLE refresh (Henry upload)

- Merged FINAL uniqueness + **Social pain** (weekend −20% gap ≠ fill; BELL search lines).
- Deadline stays **27 Sep 2026 UTC+8** (handbook); upload still said 21 Sep.

## 2026-09-23 — Desk chat + owner account + Neon

- One agent per workspace (Run agent / worker). Desk chat is a capped assistant, not a second trader.
- ChatGPT-style `/dashboard/chat`: threads, memory, reply-to, hard UTC daily cap (`VIGIL_CHAT_DAILY_LIMIT=3`).
- Platform LLM/Bitget keys stay server-side; chat cannot place trades; Bitget vault encrypted per tenant.
- Neon `vigil-db` connected on Vercel (`DATABASE_URL`). Owner `henrysammarfo@gmail.com` registered + growth allowlist NVDA/AMD/AAPL/TSLA.
- Settings: Bitget Demo connect UI + agent params (allowlist, confidence, size, FENN).

## 2026-09-23 — Per-user tenancy (own Bitget Demo)

- Signup already creates private tenant; Bitget keys were global env.
- Added encrypted `tenant_secrets` + Settings "Your Bitget Demo".
- Paper place/close resolve credentials by `tenantId`. Env fallback only if `VIGIL_ALLOW_ENV_BITGET=1`.

# Session Log

## 2026-09-23 — ≥80% WR playbooks all pairs

- High-WR lab across AMD/NVDA/AAPL/TSLA (VIP0 fees+AH spread).
- Champs locked: NVDA 90.9% robust · AAPL 83.3% robust · TSLA ~80–83% robust · AMD 80% selective (train red).
- Terminal Run backtest uses `usePlaybook` for every pair (TF + minMove + SL/RR).

## 2026-09-23 — TradingView candles + $100 book

- lightweight-charts OHLC+volume+markers; paper bankroll $100.
