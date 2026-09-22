# Session Log

## 2026-09-22 — Architecture + production spine

- Read uploaded `VIGIL_BIBLE` and live S2 handbook.
- Corrected deadline: bible said 21 Sep; official is **27 Sep 2026 UTC+8**.
- Probed APIs: TinyFish Search/Fetch OK; TinyFish Agent 0 credits; Tavily over quota; AgentRouter WAF from cloud VM; Venice models reachable.
- Repo was UI-only with static `dashboard-data.tsx`.
- Implemented: memory MDs, Cursor rules/skills, Postgres multitenant schema, cookie sessions, agent spine (`src/vigil/*`), live dashboard RPC (`src/api/dashboard.ts`), submission pack.
- Build + unit/integration tests green. Live TinyFish smoke OK.
- Secrets never written into memory docs.
- Remaining for Henry: Bitget Demo keys, LLM key reachable from deploy egress, DATABASE_URL (Cloud SQL), Tavily top-up, X post + Google Form before 27 Sep.
