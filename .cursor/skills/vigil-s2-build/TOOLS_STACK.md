# TOOLS_STACK

## App

- TanStack Start + React 19 + Tailwind 4 + shadcn
- Hosting: Cloudflare via Nitro (primary web); GCP Cloud Run for worker

## Data / secrets

- Postgres (Cloud SQL in production) via Drizzle ORM
- `SESSION_SECRET` for signed httpOnly cookies
- GCP Secret Manager for production secret material (refs only in DB)

## Agent integrations

| Role | Tool | Env |
| --- | --- | --- |
| News search | TinyFish Search | `TINYFISH_API_KEY` |
| News search alt | Tavily | `TAVILY_API_KEY` |
| Page fetch | TinyFish Fetch | `TINYFISH_API_KEY` |
| LLM primary | AgentRouter (+ Tor SOCKS / sync proxy) | `AGENTROUTER_API_KEY`, `AGENTROUTER_USE_TOR=1` |
| LLM bases | `agentrouter.org` (+ `co.agentrouter.org` alt) | `AGENTROUTER_BASE_URL`, `AGENTROUTER_ANTHROPIC_BASE` |
| LLM alternate | Venice | `VENICE_API_KEY` |
| LLM relay | CF Worker stainless relay | `VIGIL_LLM_RELAY_URL` → `worker/llm-relay.ts` |
| Paper execution | Bitget Demo API | `BITGET_API_KEY` `BITGET_API_SECRET` `BITGET_PASSPHRASE` `BITGET_PAPER=true` |

## Explicitly not used for S2 truth path

- localStorage sessions
- Hardcoded dashboard fixtures as production data
- OpenAI key requirement
