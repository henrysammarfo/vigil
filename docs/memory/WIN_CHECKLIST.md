# VIGIL S2 Win Checklist

## Submission blockers (Henry / form)

- [x] Google Form project description (6 parts) — draft in `docs/submission/STAMPIT_PACK.md`
- [x] Role of the LLM field — draft ready; declare models actually used at submit time
- [x] Submission materials link (Demo + GitHub + paper log + demo MP4)
- [ ] X post with `#BitgetHackathon` + `@Bitget_AI` + quote of official Bitget_AI status — draft in `docs/submission/X_POST.md`
- [x] Track = Agentic Trading · Sub-theme = Event-Driven Agent — drafted
- [x] University Name = ATU (if entering university pool) — drafted
- [x] Apply for Demo Day = Yes (recommended) — drafted
- [x] Paper trading log covering competition period — live Demo fill + export  
      → artifact `vigil-paper-log-1790078990545.json` · orderId `1486264474501758976`  
      → steps: [`docs/memory/BITGET_DEMO_STEPS.md`](./BITGET_DEMO_STEPS.md)
- [x] Demo video packaged — `docs/submission/artifacts/vigil-s2-demo.mp4` + script
- [x] Full product QA — `docs/submission/QA_REPORT.md` (**56/56 PASS** on 2026-10-06)

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
- [x] Mark-to-exit / paper PnL scoreboard (wins-losses) + Investopedia entry rubric
- [x] Rigorous walk-forward backtest + trade chart terminal (`/dashboard/terminal`)
- [x] Fast smart agent memory (lessons + lesson-guard + cited priors)
- [x] AMD strategy lab + ranked playbook (limit SL1% RR2.5 OOS E[R]+0.77)
- [x] Per-user Bitget Demo vault (encrypted `tenant_secrets`) + Settings UI
- [x] $100→$5k growth paper sizing + high-WR allowlist (NVDA/AMD/AAPL/TSLA)
- [x] Desk chat (ChatGPT-style memory/threads) + hard daily cap (`VIGIL_CHAT_DAILY_LIMIT=3`)
- [x] Neon Postgres on Vercel (`DATABASE_URL`) + owner workspace bootstrapped
- [x] VIGIL_BIBLE FINAL + Social pain (2026-09-24) — gap ≠ fill
- [ ] Venice / DashScope key (optional failover)
- [ ] AgentRouter Tor / clean egress on Vercel (chat LLM currently WAF-blocked without Tor)

## Next ship order

1. **Henry:** X post + Google Form (`docs/submission/S2_SUBMISSION.md`) — paper log ready  
2. **Ops:** Tor/relay for AgentRouter on Vercel so Desk chat LLM answers land (quota still counted today)  
3. Deadline: **27 Sep 2026 UTC+8**

## Pitch order

1. Closed-window thesis  
2. Agent Hub paper  
3. Explainability  
4. Metrics labeled  
5. X `#BitgetHackathon`  
6. Social pain: weekend −20% gap alone is not a fill
