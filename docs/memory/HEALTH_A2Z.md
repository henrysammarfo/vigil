# VIGIL A–Z health check — 2026-10-03

> Live base: https://vigil-one-wine.vercel.app · `main` @ `63c9418`  
> Smoke: `bun scripts/a2z-smoke.ts` → **32/32 PASS** · artifacts `/opt/cursor/artifacts/a2z-smoke/`

## Scorecard

| Area | Status | Evidence |
| --- | --- | --- |
| Public marketing pages | **OK** | `/` auth how journal privacy terms contact about → HTTP 200 |
| Security headers | **OK** | HSTS preload · X-Frame DENY · nosniff · Permissions-Policy |
| Auth gate | **OK** | `/dashboard*` → 307 → `/auth` |
| Owner login | **OK** | `henrysammarfo@gmail.com` → dashboard |
| Neon / sessions / DB | **OK** | Login + settings + chat load (no DATABASE_URL errors) |
| Overview | **OK** | WEEKEND · VIGIL ACTIVE · $100/$5000 · Run agent enabled |
| Growth book | **OK** | Equity $100 · target $5000 · 0.0% |
| Bitget Demo vault | **OK** | Settings: Connected · hint `bg_9…580c` · source **tenant** |
| Allowlist / FENN | **OK** | NVDA,AMD,AAPL,TSLA · FENN ON · paper locked |
| Desk chat UI | **OK** | Threads · daily cap · slash `/growth` etc. |
| Signals / trades / terminal / why / replay | **OK** | All HTTP 200 authenticated |
| AgentRouter from this pod (direct) | **WAF** | Captcha HTML (`aliyun_waf_aa`) |
| Tor SOCKS in this pod | **UP** | `109.70.100.13` via `:9050` |
| AgentRouter via Tor (dummy key) | **REACHABLE** | JSON 401 unauthorized (not HTML) — real key not in this pod |
| Real LLM smoke (`smoke:llm`) | **NOT RUN HERE** | `AGENTROUTER_API_KEY` / `VERCEL_TOKEN` / `DATABASE_URL` missing in agent env |
| Vercel env matrix re-list | **NOT RUN HERE** | No CLI token in this session |
| Live signals / paper fills | **IDLE** | 0 signals stored — expected until Run agent + news |
| LLM declared field | **GAP** | Settings still `undeclared` (set before Google Form) |
| Desk chat model answers on Vercel | **RISK** | Serverless has no Tor; needs `VIGIL_LLM_RELAY_URL` or answers stay WAF |

## What’s running right now

1. **Site + dashboard product path:** fully up.
2. **Your account:** logged in, Bitget Demo sealed to tenant, growth allowlist set, weekend gate open, Run agent clickable.
3. **Paper book:** $100 equity, no open signals yet.
4. **Desk chat:** UI + quota + slash commands live; model completions on Vercel still depend on relay/Tor path.

## Not verified in this agent pod (secrets absent)

- Re-list of Vercel Production env names  
- `bun run smoke:llm` with real AgentRouter key  
- Direct Postgres probe with Neon URL  

These were configured in prior sessions; app behavior (login/chat/settings) implies they remain on Vercel.

## Recommended next (ops)

1. Set Settings → **LLM declared** to actual path (e.g. `agentrouter/deepseek-v4-flash`).  
2. Confirm Vercel has `VIGIL_LLM_RELAY_URL` **or** accept Desk LLM WAF until relay is deployed (`docs/memory/AGENTROUTER_SETUP.md`).  
3. After hours/weekend: Overview → **Run agent** once TinyFish + LLM + Bitget are warm.  
4. Henry: X post + Google Form (deadline was 27 Sep UTC+8 — confirm if window extended).
