# VIGIL S2 Win Checklist

## Submission blockers (Henry / form)

- [ ] Google Form project description (6 parts) — draft in `docs/submission/S2_SUBMISSION.md`
- [ ] Role of the LLM field — draft ready; declare models actually used at submit time
- [ ] Submission materials link (Demo + GitHub + paper log)
- [ ] X post with `#BitgetHackathon` + `@Bitget_AI` + quote of official Bitget_AI status
- [ ] Track = Agentic Trading · Sub-theme = Event-Driven Agent — drafted
- [ ] University Name = ATU (if entering university pool) — drafted
- [ ] Apply for Demo Day = Yes (recommended) — drafted
- [x] Paper trading log covering competition period — live Demo fill + export  
      → artifact `vigil-paper-log-1790078990545.json` · orderId `1486264474501758976`  
      → steps: [`docs/memory/BITGET_DEMO_STEPS.md`](./BITGET_DEMO_STEPS.md)

## Product blockers

- [x] Live closed-window gate
- [x] Live news ingest (TinyFish Search OK; Tavily quota exceeded)
- [x] Live Bitget paper executor — Demo key + UTA place-order verified (`NVDAUSDT` / `AAPLUSDT` accepted)
- [x] Append-only why-log with hash
- [x] Dashboard reads from DB/API only
- [x] Multitenant cookie sessions (no localStorage auth)
- [x] Metrics labeled observed / estimated / targeted
- [x] Build + tests green; lint warnings only in shadcn UI
- [x] FENN refuse-by-default (empty allowlist → NO why-cards)
- [x] AgentRouter via Tor from cloud VM (`deepseek-v4-flash` live 200; key valid)
- [x] Full agent cycle + UI demo recording for submission
- [ ] Venice / DashScope key (optional failover)

## Next ship order

1. **Henry:** Cloudflare / Vercel prod URL + secrets (`AGENTROUTER_USE_TOR` or clean egress)
2. **Henry:** X post + Google Form (`docs/submission/S2_SUBMISSION.md`) — paper log ready

## Pitch order

1. Closed-window thesis  
2. Agent Hub paper  
3. Explainability  
4. Metrics labeled  
5. X `#BitgetHackathon`
