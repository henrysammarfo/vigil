# VIGIL Architecture (binding contract)

## Product job

Closed-market / weekend-only vigil over Bitget tokenized US stocks (rTokens).  
Only paper a trade when after-hours or weekend news actually moves the rToken — with a full why-log.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Public UI | `src/routes/*` (non-dashboard) | Marketing, brand, public journal read |
| Dashboard UI | `src/routes/dashboard*` | Tenant-scoped live views |
| Server API | `src/api/*` | TanStack server functions / HTTP handlers |
| Auth | `src/vigil/auth/*` | httpOnly cookie sessions · tenant membership |
| Agent spine | `src/vigil/agent/*` | Gates → ingest → signal → policy → paper → journal |
| Integrations | `src/vigil/integrations/*` | TinyFish, Tavily, LLM, Bitget paper |
| Persistence | `src/vigil/db/*` | Drizzle · Postgres · tenant_id on every row |
| Worker | `worker/` | Continuous closed-window runner (Cloud Run) |

## Mandatory spine

```
US RTH closed?
  → news ingest (TinyFish Search / Tavily)
  → bitget-signal / rToken move check
  → fast memory retrieve (ticker + move band) + lesson-guard
  → policy + declared LLM (memoryPriors cited)
  → Agent Hub paper order (--paper-trading)
  → append-only why-card (hash chain + memory priors)
  → lessons write on refuse / close / backtest
  → dashboard + terminal + export + replay
```

## Agent memory

Structured `agent_lessons` (not embeddings): learn from live closes, refusals, and walk-forward backtests. Hot TTL cache for retrieve. Deterministic `lesson-guard` can force WATCH before LLM when expectancy/streak is bad — still seals a why-card.
## Multitenancy

- Every business row has `tenant_id`
- Session cookie binds `userId` + active `tenantId`
- No localStorage for auth or secrets
- Credential refs store Secret Manager / env pointer names only

## Separation of concerns

- Frontend never holds API secrets
- Worker never serves HTML
- Journal is append-only (no UPDATE of sealed why-cards)
- Paper lock is hard-coded: live execution paths throw

## Naming

- Functions: camelCase · Components: PascalCase · Files: kebab-case
