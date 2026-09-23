# Agent memory design (2026-09-22)

## Goal

Fast + smart learning without hidden RAG weights. Every prior is **citable** in why-cards.

## Why not embeddings (S2)

- Explainability is the product; vector neighbors are hard to audit in a Demo pitch.
- Postgres/pglite first; no Redis/Railway.
- Structured outcomes (win/loss/refuse) beat cosine similarity for FENN gates.

## Design

| Piece | Behavior |
| --- | --- |
| `agent_lessons` | ticker, move, gate, outcome, pnl, summary, source |
| Hot cache | 15s TTL per tenant\|ticker\|bucket |
| Retrieve | same ticker + nearest \|move\|; prefer losses/refusals for caution |
| lesson-guard | block PAPER when E&lt;−0.5 (n≥3), 3-loss streak, or WR≤20% (n≥5) |
| LLM | `memoryPriors[]` in user JSON |
| Learn | refuse/watch seal · Demo exit · backtest batch |

## Honesty

Live closes → `observed` memory label when present; backtest-only → `estimated`.
