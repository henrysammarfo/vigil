# API Status (live probes · 2026-09-23)

> Never store secret values in this file. Only status, hosts, and required env var **names**.

## Integration matrix

| Service | Env var name(s) | Probe result | Notes |
| --- | --- | --- | --- |
| TinyFish Search | `TINYFISH_API_KEY` | **OK** (HTTP 200) | `https://api.search.tinyfish.ai` · `X-API-Key` |
| TinyFish Fetch | `TINYFISH_API_KEY` | **OK** (HTTP 200) | Does **not** forward `Authorization` to targets |
| TinyFish Agent / Browser | `TINYFISH_API_KEY` | **0 credits** (403) | Not required for news |
| Tavily Search | `TAVILY_API_KEY` | **Quota exceeded** | Top-up or rely on TinyFish |
| AgentRouter LLM | `AGENTROUTER_API_KEY` + `AGENTROUTER_USE_TOR=1` | **OK via Tor** (re-probed 2026-09-23) | `smoke_llm_tor_ok` · `deepseek-v4-flash` live JSON via Tor SOCKS |
| Venice LLM | `VENICE_API_KEY` | Optional failover | |
| DashScope / Qwen | `DASHSCOPE_API_KEY` / `QWEN_API_KEY` | Optional | |
| LLM relay | `VIGIL_LLM_RELAY_URL` | Optional | `worker/llm-relay.ts` |
| Bitget Demo | `BITGET_*` + `BITGET_PAPER=true` | **OK** | Per-tenant vault preferred; env fallback with `VIGIL_ALLOW_ENV_BITGET=1` |
| Database | `DATABASE_URL` | Required | Postgres / `pglite:memory` local |
| Session | `SESSION_SECRET` | Required | ≥32 bytes |

## Paper growth ($100 → $5,000)

| Item | Status |
| --- | --- |
| Backtest high-WR playbooks | NVDA ~82% OOS robust (primary); AMD/AAPL/TSLA lab champs ≥80% (sample-sensitive) |
| Serious bankroll | `$100` start · target `$5000` · growth-sized qty (never spray Demo) |
| Allowlist | `NVDA, AMD, AAPL, TSLA` via Settings or `VIGIL_GROWTH_ALLOWLIST=1` |
| Closed-window gate | Stands down during US RTH — paper only after hours / weekend |
| Enable script | `bun scripts/enable-growth-paper.ts --tenant=<id> [--run]` |

## AgentRouter — Tor clears Aliyun captcha

```bash
bun run tor:start
export AGENTROUTER_USE_TOR=1
export VIGIL_LLM_MODEL=deepseek-v4-flash
bun run smoke:llm
```
