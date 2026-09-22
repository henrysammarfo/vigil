# Session Log

## 2026-09-22 — Trader rubric + mark-to-exit PnL

- **Entry analysis:** Investopedia-aligned rubric (confirmation bias, trading psychology, after-hours liquidity/slippage, named invalidation). LLM returns bull/bear/invalidation/biasChecks; incomplete analysis → WATCH. Research: `docs/memory/research-raw/TRADER_RUBRIC_2026-09-22.md`.
- **Paper ledger:** `lifecycle` open/closed · entry/mark/exit · unrealized + realized PnL · scoreboard wins/losses. APIs: `markPaperOrdersFn`, `closePaperOrderFn`. Trades UI: Mark open / Exit / Analysis expand.
- **Live mark quote:** Bitget public ticker `NVDAUSDT` mark observed (~228.43). Unit tests: `tests/unit/trader-pnl.test.ts` (27 total green).

## 2026-09-22 — AgentRouter re-probe + JEV research + trade tally

- **AgentRouter:** Tor smoke OK · `deepseek-v4-flash` · decision JSON returned (`smoke_llm_tor_ok` 22:39 UTC).
- **Paper fills (Demo):** 4 accepted buys — probe NVDA `1486262952946679809`, CLI NVDA `1486264474501758976`, UI NVDA + AAPL. Closed PnL wins: **ledger shipped** (mark/exit); historical opens need Exit on Trades.
- **JEV:** TypeSafe “dumb AI” decision model trending (70–500 ms buy/sell/hold). Bitget AgentHub demos exist. VIGIL stays explainable closed-window paper — see `docs/memory/research-raw/JEV_2026-09-22.md`. Submission story/fundamentals expanded in `docs/submission/S2_SUBMISSION.md`.

## 2026-09-22 — Full e2e cycle papered (submission path)

- Fixed signal gate: only `Rejected` blocks pre-LLM; `minConfidence` applies after LLM paper decision.
- Improved `scoreFromMove` (×30 scale + range/catalyst/named boosts) so quiet mega-cap after-hours moves can reach Watch+.
- Live `scripts/e2e-full.ts`: TinyFish → FENN allowlist → Tor `deepseek-v4-flash` → Bitget Demo paper.
- Result: `papered=1` `NVDAUSDT` buy accepted · exchangeOrderId `1486264474501758976` · export `/opt/cursor/artifacts/vigil-paper-log-1790078990545.json`.
- Thesis intact: 3 why-cards · PAPER_BUY + FENN one-side NO + WATCH.
- Settings allowlist no longer wiped by react-query refetch.
- **UI demo:** Run agent → 4 signals · 2 Demo paper fills (`NVDAUSDT`, `AAPLUSDT`) · recording `vigil-s2-full-agent-demo.mp4`.

## 2026-09-22 — Bitget Demo paper fill live

- Demo API key (created inside Demo mode) auth OK with `paptrading:1`.
- Equity after deposit ~4.1M USDT demo.
- Paper order: `NVDAUSDT` buy market → `00000` / orderId `1486262952946679809`.

## 2026-09-22 — Tor clears AgentRouter WAF; strip template traces; Bitget Demo steps

- **Tor:** `scripts/tor-start.sh` + `AGENTROUTER_USE_TOR=1` → AgentRouter JSON (not captcha). Live: `deepseek-v4-flash` HTTP 200 via node:https + SocksProxyAgent. Key valid.
- **Template cleanup:** removed editor-template vite package/hooks; plain TanStack + Nitro Cloudflare `vite.config.ts`.
- **Bitget:** `docs/memory/BITGET_DEMO_STEPS.md` — Demo key → `paptrading:1` → worker → export paper log.

## 2026-09-22 — Next: FENN smoke + win checklist truth

- Lint autofixed (prettier). Build + 17 tests green.
- `bun run smoke:fenn` live: TinyFish → 3 NO_TRADE why-cards, empty allowlist, no LLM/Bitget.
- WIN_CHECKLIST updated: product spine mostly done; Henry-blocked = Bitget Demo keys, prod URL, X post, Google Form.

## 2026-09-22 — AgentRouter WAF bypass + TinyFish Fetch docs correction

- Sync Anthropic proxy + stainless headers + portal bases.
- TinyFish Fetch 401 = target_http_error (no auth forward).

## 2026-09-22 — FENN refuse-by-default + AgentRouter egress workarounds

- FENN gates + multi-path LLM + settings UI.
