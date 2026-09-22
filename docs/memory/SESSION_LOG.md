# Session Log

## 2026-09-22 — Backtest + trade terminal

- **Backtest engine:** deterministic FENN + score + rubric + hold/invalidation + AH slippage; walk-forward 70/30. Candles observed via Bitget history API.
- **Live OOS (1H × 360 bars):** NVDA test 4t / 0% WR / −5.15 · AAPL test 2t / 0% WR / −2.56 (train was +1.41 — walk-forward caught overfit) · TSLA test 4t / 25% WR / −4.35. Honest: spike-chase mean-reverts under this policy.
- **Terminal UI:** `/dashboard/terminal` — price chart + entry/exit dots, order blotter, PnL tiles, Run backtest equity curve.
- CLI: `bun run backtest -- --symbol NVDAUSDT`. Tests: 30 green.

## 2026-09-22 — Trader rubric + mark-to-exit PnL

- **Entry analysis:** Investopedia-aligned rubric (confirmation bias, trading psychology, after-hours liquidity/slippage, named invalidation). LLM returns bull/bear/invalidation/biasChecks; incomplete analysis → WATCH. Research: `docs/memory/research-raw/TRADER_RUBRIC_2026-09-22.md`.
- **Paper ledger:** `lifecycle` open/closed · entry/mark/exit · unrealized + realized PnL · scoreboard wins/losses. APIs: `markPaperOrdersFn`, `closePaperOrderFn`. Trades UI: Mark open / Exit / Analysis expand.
- **Live mark quote:** Bitget public ticker `NVDAUSDT` mark observed (~228.43). Unit tests: `tests/unit/trader-pnl.test.ts`.
- **Live Demo mark-to-exit:** open `1486426725464522752` → close `1486426726529875968` (flat instantaneous round-trip).

## 2026-09-22 — AgentRouter re-probe + JEV research + trade tally

- **AgentRouter:** Tor smoke OK · `deepseek-v4-flash` · decision JSON returned (`smoke_llm_tor_ok` 22:39 UTC).
- **Paper fills (Demo):** 4 accepted buys — probe NVDA, CLI NVDA, UI NVDA + AAPL. Closed PnL ledger shipped.
- **JEV:** TypeSafe “dumb AI” decision model trending. VIGIL stays explainable closed-window paper — see `docs/memory/research-raw/JEV_2026-09-22.md`.

## 2026-09-22 — Full e2e cycle papered (submission path)

- Signal gate + scoring fixes; live e2e papered NVDAUSDT; UI demo recording `vigil-s2-full-agent-demo.mp4`.

## 2026-09-22 — Bitget Demo paper fill live

- Demo API + `paptrading:1` · NVDAUSDT buy accepted.

## 2026-09-22 — Tor clears AgentRouter WAF; Bitget Demo steps

- Tor + stainless → AgentRouter JSON. See `docs/memory/BITGET_DEMO_STEPS.md`.
