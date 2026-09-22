# API Status (live probes · 2026-09-22)

> Never store secret values in this file. Only status, hosts, and required env var **names**.

## Integration matrix

| Service | Env var name(s) | Probe result | Notes |
| --- | --- | --- | --- |
| TinyFish Search | `TINYFISH_API_KEY` | **OK** (HTTP 200) | `https://api.search.tinyfish.ai` · `X-API-Key` |
| TinyFish Fetch | `TINYFISH_API_KEY` | **OK** (HTTP 200) | Does **not** forward `Authorization` to targets |
| TinyFish Agent / Browser | `TINYFISH_API_KEY` | **0 credits** (403) | Not required for news |
| Tavily Search | `TAVILY_API_KEY` | **Quota exceeded** | Top-up or rely on TinyFish |
| AgentRouter LLM | `AGENTROUTER_API_KEY` + `AGENTROUTER_USE_TOR=1` | **OK via Tor** (re-probed 22:39 UTC) | Direct cloud IP → captcha HTML; Tor + stainless → live JSON. `deepseek-v4-flash` **HTTP 200**; `claude-opus-4-8` → budget exhausted (key valid) |
| Venice LLM | `VENICE_API_KEY` | Optional failover | |
| DashScope / Qwen | `DASHSCOPE_API_KEY` / `QWEN_API_KEY` | Optional | |
| LLM relay | `VIGIL_LLM_RELAY_URL` | Optional | `worker/llm-relay.ts` |
| Bitget Demo | `BITGET_*` + `BITGET_PAPER=true` | **OK** (Demo key + paper fill) | UTA `/api/v3/trade/place-order` + `paptrading:1` · live probe `NVDAUSDT` orderId accepted · equity ~4.1M USDT demo · public mark ticker OK (`NVDAUSDT` ~228.43) · mark-to-exit via opposite market + ledger |
| Database | `DATABASE_URL` | Required | Postgres / `pglite:memory` local |
| Session | `SESSION_SECRET` | Required | ≥32 bytes |

## AgentRouter — Tor clears Aliyun captcha

| Path | Result |
| --- | --- |
| Direct from Cursor VM | Captcha HTML (`aliyun_waf_*`) |
| Tor SOCKS `socks5h://127.0.0.1:9050` + stainless/QwenCode headers | JSON API (WAF passed) |
| Models listed via Tor | `claude-opus-4-8`, `claude-opus-5`, `deepseek-v4-flash`, `gpt-6-astra` |
| Live completion | `deepseek-v4-flash` → 200 `"ok"` |
| `co.agentrouter.org` | `Invalid API Key` for this key pool — prefer `agentrouter.org` |

```bash
bun run tor:start
export AGENTROUTER_USE_TOR=1
export VIGIL_LLM_MODEL=deepseek-v4-flash
bun run smoke:llm
```

## TinyFish Fetch “401”

Fetch returns HTTP 200 with `errors: [{ error: "target_http_error", status: 401 }]` when the **target** needs auth. Not a bad TinyFish key.

## Fail-closed

- Missing LLM → `LLM_NOT_CONFIGURED`
- Missing Bitget Demo → `BITGET_PAPER_NOT_CONFIGURED`
- Missing news → `NEWS_PROVIDER_UNAVAILABLE`
- Never invent fills / UIDs / headlines
