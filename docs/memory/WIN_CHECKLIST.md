# VIGIL S2 Win Checklist

## Submission blockers (Henry / form)

- [ ] Google Form project description (6 parts) — draft in `docs/submission/S2_SUBMISSION.md`
- [ ] Role of the LLM field — draft ready; declare models actually used at submit time
- [ ] Submission materials link (Demo + GitHub + paper log)
- [ ] X post with `#BitgetHackathon` + `@Bitget_AI` + quote of official Bitget_AI status
- [ ] Track = Agentic Trading · Sub-theme = Event-Driven Agent — drafted
- [ ] University Name = ATU (if entering university pool) — drafted
- [ ] Apply for Demo Day = Yes (recommended) — drafted
- [ ] Paper trading log covering competition period — needs Bitget Demo key + live runs

## Product blockers

- [x] Live closed-window gate
- [x] Live news ingest (TinyFish Search OK; Tavily quota exceeded)
- [ ] Live Bitget paper executor — code ready; **needs Demo API keys**
- [x] Append-only why-log with hash
- [x] Dashboard reads from DB/API only
- [x] Multitenant cookie sessions (no localStorage auth)
- [x] Metrics labeled observed / estimated / targeted
- [x] Build + tests green (`bun run build`, `bun run test`); lint warnings only in shadcn UI
- [x] FENN refuse-by-default (empty allowlist → NO why-cards, no LLM/Bitget)
- [ ] AgentRouter live completion from Cursor VM — WAF captcha on this IP; bypass shipped for clean egress (`AGENTROUTER_PROXY_URL` / `VIGIL_LLM_RELAY_URL` / Lovable)
- [ ] Venice / DashScope key (optional failover when AR blocked)

## Next ship order (priority)

1. **Henry:** Bitget Demo keys → live paper log for competition period  
2. **Henry:** Deploy Lovable/CF + optional `VENICE_API_KEY` or relay on clean egress  
3. **Agent:** FENN empty-allowlist live smoke (TinyFish → why-cards, no LLM)  
4. **Henry:** X post + Google Form using `docs/submission/S2_SUBMISSION.md`

## Pitch order

1. Closed-window thesis  
2. Agent Hub paper  
3. Explainability  
4. Metrics labeled  
5. X `#BitgetHackathon`
