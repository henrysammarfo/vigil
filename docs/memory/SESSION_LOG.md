# Session Log

## 2026-09-23 — AMD backtest + SL/TP/R:R engine

- Backtest now supports **market | limit** entry, **stop-loss (1R)**, **take-profit @ R:R**, R-multiples, unfilled-limit refusals, stop-first same-bar honesty.
- **AMDUSDT 1H×480 walk-forward OOS:**
  - Market SL 1.2% RR 1:2 → 10t · 40% WR · +10.67 · E[R]=+0.15 · PF 1.30 (SL×4 TP×2)
  - Limit offset 12bps → 8t · 62.5% WR · +30.41 · E[R]=+0.55 · PF 2.38 · 2 unfilled
  - 15m market RR 1:2.5 → OOS weak (−13.3) while train +26.6 — WF overfit catch
- CLI: `bun run backtest -- --symbol AMDUSDT --entry limit --sl 0.012 --rr 2`

## 2026-09-22 — Fast smart agent memory

- `agent_lessons` + lesson-guard + cited priors. Terminal memory panel.

## 2026-09-22 — Backtest + trade terminal / rubric / Demo spine

- Prior: walk-forward, mark-to-exit, Investopedia rubric, Tor AgentRouter, FENN.
