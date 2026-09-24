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
