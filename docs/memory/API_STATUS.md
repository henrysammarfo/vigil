# API Status (live probes · 2026-09-22)

> Never store secret values in this file. Only status, hosts, and required env var **names**.

## Integration matrix

| Service | Env var name(s) | Probe result | Notes |
| --- | --- | --- | --- |
| TinyFish Search | `TINYFISH_API_KEY` | **OK** (HTTP 200) | Host: `https://api.search.tinyfish.ai?query=` · header `X-API-Key` |
| TinyFish Fetch | `TINYFISH_API_KEY` | **OK** schema | Host: `https://api.fetch.tinyfish.ai` · body `{ "urls": [...] }` |
| TinyFish Agent | `TINYFISH_API_KEY` | **0 credits** | Host: `https://agent.tinyfish.ai/v1/automation/run` · optional |
| Tavily Search | `TAVILY_API_KEY` | **Quota exceeded** | Needs top-up; do not fake news if down |
| AgentRouter LLM | `AGENTROUTER_API_KEY` | **WAF captcha from this cloud VM** (re-checked 2026-09-22) | Base `https://agentrouter.org/v1` · key may work from your laptop / Cloud Run egress outside Aliyun WAF · not proven live here |
| Venice LLM | `VENICE_API_KEY` | Models endpoint reachable (no key needed to list) | Use as alternate until AgentRouter egress works |
| Qwen (Bitget build credits) | n/a (Telegram after KYC form) | **Optional** | Not required to submit; first 300 KYC-passed teams may get ~30U credits — separate Google Form |
| Bitget Agent Hub | `BITGET_API_KEY` · `BITGET_API_SECRET` · `BITGET_PASSPHRASE` · `BITGET_PAPER=true` | **Not configured** | Demo key required for paper orders |
| Clerk | `CLERK_SECRET_KEY` · `VITE_CLERK_PUBLISHABLE_KEY` | Optional | If unset, app uses secure cookie session auth |
| Database | `DATABASE_URL` | Required | Postgres (Cloud SQL in prod) |
| Session | `SESSION_SECRET` | Required | ≥32 bytes random |

## Fail-closed policy

- Missing LLM key → agent run errors with explicit `LLM_NOT_CONFIGURED` (no silent mock decisions)
- Missing Bitget Demo credentials → paper executor errors with `BITGET_PAPER_NOT_CONFIGURED`
- Missing news providers → ingest errors with `NEWS_PROVIDER_UNAVAILABLE` (no invented headlines)
- Trading path never invents fills, prices, or UIDs

## Wrong hosts (do not use)

- `api.tinyfish.ai` — does not resolve
- OpenAI — not required for VIGIL; no `OPENAI_API_KEY` assumed
