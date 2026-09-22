# VIGIL

Closed-market Event-Driven Agent for Bitget AI Base Camp S2.

While US RTH sleeps, VIGIL watches Bitget tokenized US stocks and only papers a trade when after-hours or weekend news actually moves the rToken — with an append-only why-log.

## Stack

- Frontend: TanStack Start (Lovable / Cloudflare)
- DB: Postgres (Cloud SQL in production) via Drizzle
- Sessions: httpOnly cookies (no localStorage auth)
- Worker: `worker/index.ts` (Cloud Run)
- Integrations: TinyFish Search, Tavily, AgentRouter/Venice LLM, Bitget Demo paper

## Quick start

```bash
cp .env.example .env
# fill DATABASE_URL, SESSION_SECRET (≥32 chars), TINYFISH_API_KEY, LLM key, Bitget Demo keys
bun install
bun run dev
```

For local DB without Cloud SQL:

```bash
DATABASE_URL=pglite:memory SESSION_SECRET=dev-session-secret-32chars-min!! bun run dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run test` | Unit + integration tests |
| `bun run smoke:live` | Live TinyFish Search smoke |
| `bun run worker` | Continuous paper runner |
| `bun run build` | Production build |
| `bun run lint` | ESLint |

## Docs

- [`docs/memory/VIGIL_BIBLE.md`](docs/memory/VIGIL_BIBLE.md) — corrected bible (deadline **27 Sep 2026 UTC+8**)
- [`docs/memory/ARCHITECTURE.md`](docs/memory/ARCHITECTURE.md)
- [`docs/submission/S2_SUBMISSION.md`](docs/submission/S2_SUBMISSION.md)

## Honesty

Paper only · not financial advice · never invent Bitget UID · metrics labeled · not unhackable.

Built with [Lovable](https://lovable.dev/projects/1d69d1e8-a14b-4ec5-a21f-0f7de50470f1).
