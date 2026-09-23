# Session Log

## 2026-09-23 — Fees, spread, rebates in backtest

- Cost model: Bitget VIP0 futures **maker 0.02% / taker 0.06%**, optional maker rebate, half-spread (AMD observed ~0.35 bps × AH×3).
- Limit/TP = maker; market/stop/time = taker + spread. Net PnL = gross − fees + rebates − spread.
- **AMD limit SL1%/RR2.5 OOS after costs:** gross +35.4 → **net +32.1** · fees 3.02 · spread 0.30 · E[R] **+0.69** (still best).

## 2026-09-23 — AMD strategy lab + SL/TP engine

- Lab winner limit SL1% RR2.5; playbook + memory seeds; MI300 scoring.

## 2026-09-22 — Memory + Demo spine

- agent_lessons · mark-to-exit · FENN · Tor AgentRouter.
