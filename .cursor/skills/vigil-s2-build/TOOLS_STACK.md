# TOOLS_STACK

## App

- TanStack Start + React 19 + Tailwind 4 + shadcn (existing Lovable template)
- Hosting: Cloudflare via Nitro (Lovable default)

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
| LLM primary | AgentRouter OpenAI-compatible | `AGENTROUTER_API_KEY` |
| LLM alternate | Venice | `VENICE_API_KEY` |
| Paper execution | Bitget Agent Hub / Demo API | `BITGET_API_KEY` `BITGET_API_SECRET` `BITGET_PASSPHRASE` `BITGET_PAPER=true` |

## Explicitly not used for S2 truth path

- localStorage sessions
- Hardcoded dashboard fixtures as production data
- OpenAI key requirement
