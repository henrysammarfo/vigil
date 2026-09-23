# AMD strategy lab — VIGIL (2026-09-23)

Paper / Demo only. Candles = observed Bitget USDT-FUTURES. PnL = estimated.

## Method

- Walk-forward 70/30 on 1H × ~480 bars
- Grid: market|limit × with_move|fade × SL{1.0,1.2,1.5}% × RR{1.5,2,2.5}
- Score = 3·E[R] + 0.4·PF + WR − overfit penalty

## Winner (OOS)

| Field | Value |
| --- | --- |
| Entry | **limit** pullback (~12 bps) |
| Direction | **with_move** (chase catalyst) |
| Stop | **1.0%** (1R) |
| Take profit | **2.5R** |
| OOS | 8 trades · 62.5% WR · PnL +35.6 · E[R] **+0.77** · PF **2.92** |
| Train | +33.3 (aligned — not a blow-up) |

Fade variants generally underperformed on this tape.

## VIGIL defaults

`src/vigil/agent/playbooks/amd.ts` rank #1 · Terminal AMD run uses `usePlaybook: true` · Memory seeds cite this lab when live sample is thin.

## Re-run

```bash
bun run lab:amd
```

Artifact: `docs/memory/research-raw/AMD_STRATEGY_LAB_LATEST.json`
