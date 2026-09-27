# AgentRouter — perfect setup prompt (VIGIL)

> Copy this whole file as a prompt to an agent/operator. Never put real API keys in git.
> Last aligned to VIGIL code: `src/vigil/integrations/llm.ts` · `scripts/tor-start.sh` · `scripts/smoke-llm-tor.ts`

---

## Goal

Make AgentRouter return **JSON chat completions** every time from cloud VMs and Vercel.
Direct cloud egress to `agentrouter.org` is often **Aliyun WAF captcha HTML** — not a bad key.
Fix = **Tor SOCKS** (workers / local / Cursor VM) or a **clean-egress relay** (Vercel serverless).

## Non-negotiables

1. Prefer host **`https://agentrouter.org`** (OpenAI base `…/v1`). `co.agentrouter.org` may reject this key pool.
2. Always send **stainless / QwenCode-style headers** (VIGIL already does this for AgentRouter paths).
3. From cloud IPs: **`AGENTROUTER_USE_TOR=1`** + Tor on `socks5h://127.0.0.1:9050`.
4. Bun must **not** use undici+SocksProxyAgent for Tor — VIGIL tunnels with Node `https` + `SocksProxyAgent`.
5. Default model: **`deepseek-v4-flash`** (proven live via Tor). Opus may be budget-exhausted even when key is valid.
6. Never put `AGENTROUTER_API_KEY` in `VITE_*` or client bundles.

## Env (canonical)

```bash
# Required
AGENTROUTER_API_KEY=sk-...          # from agentrouter.org dashboard / key pool

# Bases (defaults match VIGIL)
AGENTROUTER_BASE_URL=https://agentrouter.org/v1
AGENTROUTER_ANTHROPIC_BASE=https://agentrouter.org

# Tor (required on cloud VMs / Cursor / GCP workers)
AGENTROUTER_USE_TOR=1
AGENTROUTER_TOR_SOCKS=socks5h://127.0.0.1:9050

# Model + failover order
VIGIL_LLM_MODEL=deepseek-v4-flash
VIGIL_LLM_ORDER=relay,agentrouter-proxy,agentrouter,agentrouter-anthropic,venice,dashscope

# Optional — local Anthropic-fingerprint proxy (Messages API)
# AGENTROUTER_PROXY_URL=http://127.0.0.1:7187

# Optional — clean-egress relay for Vercel (no Tor in serverless)
# VIGIL_LLM_RELAY_URL=https://YOUR_RELAY/v1
# VIGIL_LLM_RELAY_KEY=same-or-relay-auth
```

Also set on Vercel **Production + Preview** (server-only): `AGENTROUTER_API_KEY`, `VIGIL_LLM_MODEL`, and either Tor-capable worker **or** `VIGIL_LLM_RELAY_URL`.

## Path A — Perfect local / Cursor VM / GCP worker (Tor)

```bash
# 1) Install Tor once
sudo apt-get update && sudo apt-get install -y tor

# 2) Start SOCKS (idempotent)
cd /path/to/vigil
bun run tor:start
# expect: Tor ready socks5h://127.0.0.1:9050

# 3) Prove Tor egress
curl -sS --max-time 15 --socks5-hostname 127.0.0.1:9050 https://api.ipify.org && echo

# 4) Load secrets (never commit)
export AGENTROUTER_API_KEY=sk-...
export AGENTROUTER_USE_TOR=1
export AGENTROUTER_TOR_SOCKS=socks5h://127.0.0.1:9050
export VIGIL_LLM_MODEL=deepseek-v4-flash
export VIGIL_LLM_ORDER=agentrouter

# 5) Smoke (must print smoke_llm_tor_ok)
bun run smoke:llm
```

Success looks like:

```
tor socks5h://127.0.0.1:9050 models [ deepseek-v4-flash ... ]
provider agentrouter model deepseek-v4-flash path ...+tor
decision { action, confidence, rationale, ... }
smoke_llm_tor_ok
```

Failure modes:

| Symptom | Cause | Fix |
| --- | --- | --- |
| HTML / `aliyun_waf` / captcha | Direct IP, Tor off | `bun run tor:start` + `AGENTROUTER_USE_TOR=1` |
| `WAF_BLOCKED` | Same | Confirm SOCKS works via `curl --socks5-hostname` |
| `Budget pool` / channel exhausted | Model quota | Switch `VIGIL_LLM_MODEL=deepseek-v4-flash` or top up |
| `Invalid API Key` on `co.agentrouter.org` | Wrong host/pool | Use `agentrouter.org` only |
| Tor bootstrap timeout | Network / tor not installed | Check `/tmp/vigil-tor-run/tor.log` |

## Path B — Optional local Anthropic sync proxy

Only if you need Anthropic Messages fingerprinting on top of Tor:

```bash
bun run tor:start
export AGENTROUTER_API_KEY=sk-...
export HTTPS_PROXY=socks5h://127.0.0.1:9050
cd scripts/agentrouter-proxy && pip install -r requirements.txt && bash start.sh
export AGENTROUTER_PROXY_URL=http://127.0.0.1:7187
export VIGIL_LLM_ORDER=agentrouter-proxy,agentrouter
```

## Path C — Perfect Vercel production (no Tor in Functions)

Vercel serverless **cannot** keep a Tor daemon. Desk chat / agent on Vercel will `WAF_BLOCKED` if it hits AgentRouter direct from the Function IP.

**Do this:**

1. Deploy `worker/llm-relay.ts` on **Cloudflare Workers** (or any cool-IP / residential egress host).
2. Relay must forward to `https://agentrouter.org/v1/chat/completions` with stainless headers (already in file).
3. Prefer Tor **on the relay host** if that host’s IP is also WAF’d; CF egress often works without Tor.
4. Set Vercel envs:

```bash
VIGIL_LLM_RELAY_URL=https://YOUR_RELAY.workers.dev/v1
VIGIL_LLM_RELAY_KEY=<optional shared secret or reuse AgentRouter key>
VIGIL_LLM_ORDER=relay,agentrouter
VIGIL_LLM_MODEL=deepseek-v4-flash
AGENTROUTER_API_KEY=sk-...   # still needed if relay uses it server-side
```

5. Redeploy. Smoke from browser Desk chat (counts against `VIGIL_CHAT_DAILY_LIMIT`).

## Path D — Long-running paper worker (GCP / VPS)

```bash
bun run tor:start
export AGENTROUTER_USE_TOR=1
export AGENTROUTER_API_KEY=sk-...
export VIGIL_LLM_MODEL=deepseek-v4-flash
export DATABASE_URL=...
export SESSION_SECRET=...
export BITGET_PAPER=true
# Prefer tenant vault; ops fallback only:
# export VIGIL_ALLOW_ENV_BITGET=1
bun run worker
```

## Headers AgentRouter expects (already in VIGIL)

```
Authorization: Bearer <key>
Content-Type: application/json
Accept: application/json
User-Agent: QwenCode/0.2.0 (linux; x64)
x-stainless-lang: js
x-stainless-package-version: 6.34.0
x-stainless-os: Linux
x-stainless-arch: x64
x-stainless-runtime: node|bun
x-stainless-runtime-version: ...
x-stainless-retry-count: 0
```

## Minimal curl via Tor (debug outside VIGIL)

```bash
curl -sS --socks5-hostname 127.0.0.1:9050 \
  https://agentrouter.org/v1/chat/completions \
  -H "Authorization: Bearer $AGENTROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "User-Agent: QwenCode/0.2.0 (linux; x64)" \
  -H "x-stainless-lang: js" \
  -H "x-stainless-package-version: 6.34.0" \
  -H "x-stainless-os: Linux" \
  -H "x-stainless-arch: x64" \
  -H "x-stainless-runtime: node" \
  -H "x-stainless-runtime-version: node/20.0.0" \
  -H "x-stainless-retry-count: 0" \
  -d '{"model":"deepseek-v4-flash","temperature":0.1,"messages":[{"role":"user","content":"ping"}]}'
```

Must return JSON with `choices[0].message.content`. HTML = still WAF’d.

## Acceptance checklist

- [ ] `bun run tor:start` → Bootstrapped 100%
- [ ] `curl --socks5-hostname … ipify` returns an IP
- [ ] `bun run smoke:llm` → `smoke_llm_tor_ok`
- [ ] Trading scorer path uses Tor (`path` contains `+tor`)
- [ ] Vercel Desk chat either uses `VIGIL_LLM_RELAY_URL` or fails closed with clear error (never leaks key)
- [ ] Key never in frontend / screenshots / git

## Operator prompt (paste to another agent)

```
Set up AgentRouter perfectly for the VIGIL repo.

1. Read docs/memory/AGENTROUTER_SETUP.md and src/vigil/integrations/llm.ts.
2. Install/start Tor via bun run tor:start.
3. Set AGENTROUTER_API_KEY, AGENTROUTER_USE_TOR=1, VIGIL_LLM_MODEL=deepseek-v4-flash.
4. Run bun run smoke:llm until smoke_llm_tor_ok.
5. For Vercel: deploy worker/llm-relay.ts on clean egress and set VIGIL_LLM_RELAY_URL + VIGIL_LLM_ORDER=relay,agentrouter; redeploy.
6. Do not commit secrets. Prefer agentrouter.org over co.agentrouter.org.
7. Report: tor IP, smoke output, vercel env names set (not values), any WAF leftovers.
```
