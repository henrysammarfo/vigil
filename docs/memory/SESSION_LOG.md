# Session Log

## 2026-09-23 — AMD strategy lab + playbook learning

- Grid sweep market|limit × chase|fade × SL × RR on AMDUSDT 1H×480 WF.
- **Winner:** limit + with_move + SL **1.0%** + RR **1:2.5** → OOS 8t · 62.5% WR · E[R] **+0.77** · PF **2.92**.
- Fade underperforms on this tape. 15m still overfits.
- Codified in `playbooks/amd.ts` (rank #1) · Terminal AMD uses playbook · memory seeds cite lab when thin.
- Signal: AMD named + MI300/semi catalyst boost. CLI: `bun run lab:amd`.

## 2026-09-23 — SL/TP/R:R engine + AMD first runs

- Market/limit · stop · take-profit · R-multiples. Earlier AMD limit RR2 was strong; lab refined to SL1%/RR2.5.

## 2026-09-22 — Memory + terminal + Demo spine

- agent_lessons · lesson-guard · mark-to-exit · FENN · Tor AgentRouter.
