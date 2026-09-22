# BUILD_SPEC

## V1 production scope

1. Multitenant accounts with httpOnly cookie sessions
2. Closed-window clock (US RTH / after-hours / weekend)
3. News ingest via TinyFish Search (Tavily when funded)
4. Signal / rToken movement check module
5. LLM policy decision (AgentRouter or Venice) with model declaration
6. Bitget Agent Hub paper executor (Demo key, paper lock)
7. Append-only why-log with hash chain
8. Live dashboard + public journal + export + replay
9. Worker for continuous competition-period paper runs
10. S2 submission markdown pack

## Non-goals for S2

- Live-money trading
- Claiming unhackable security
- Invented backtest Sharpe without observed logs

## File map

| Concern | Path |
| --- | --- |
| Schema | `src/vigil/db/schema.ts` |
| Sessions | `src/vigil/auth/session.ts` |
| Agent pipeline | `src/vigil/agent/pipeline.ts` |
| Worker entry | `worker/index.ts` |
| Dashboard data API | `src/api/dashboard.ts` |
