# Session Log

## 2026-09-22 — Fast smart agent memory

- **`agent_lessons` table** + hot TTL retrieve (ticker + move band). No embeddings.
- **Learn:** refuse/watch → lesson; mark-to-exit → win/loss; backtest Run → batch lessons.
- **Smart:** `lesson-guard` blocks paper when expectancy &lt; −0.5 (n≥3) or 3-loss streak / WR≤20% (n≥5). Priors cited into LLM + why-card.
- **UI:** Terminal → Agent memory panel. API: `memoryDigestFn`.
- Tests: `tests/unit/memory.test.ts`.

## 2026-09-22 — Backtest + trade terminal

- Walk-forward backtest + `/dashboard/terminal` chart blotter. Live OOS mostly negative (honest spike-chase).

## 2026-09-22 — Trader rubric + mark-to-exit PnL

- Investopedia entry rubric; paper lifecycle PnL; Demo open/close verified.

## 2026-09-22 — AgentRouter / FENN / Demo spine

- Tor AgentRouter OK; FENN refuse-by-default; Demo paper fills; see prior entries / research-raw.
