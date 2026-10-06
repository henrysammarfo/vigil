# VIGIL S2 Submission Pack

## Form fields (copy into Google Form)

### Track / theme
- Track: **Agentic Trading**
- Sub-theme: **Event-Driven Agent**
- University Name: **ATU**
- Apply for Demo Day: **Yes**
- Apply for K3 Token Subsidy: optional

### Role of the LLM
VIGIL scores closed-market events with a multi-path LLM gateway: **AgentRouter** primary over Tor (`AGENTROUTER_USE_TOR=1`, OpenAI-compatible `/v1/chat/completions`, stainless/QwenCode headers; live: `deepseek-v4-flash`), with Anthropic Messages / Venice / DashScope failover. Declared provider+model are sealed on every decision/why-card. FENN empty-allowlist refuses with deterministic `fenn-gate` NO cards and never calls the LLM. The LLM does not place live orders; Bitget Demo UTA `/api/v3/trade/place-order` + `paptrading:1` executes paper only.

### Project description (six parts)

1. **Thesis** — While US RTH is closed, Bitget tokenized US stocks (rTokens / Demo stock futures) still move on news. VIGIL only activates in that closed window, checks observed move vs headline, then papers **one** allowlisted name with a full why-log. Most headlines become NO cards on purpose (FENN).
2. **Target user** — Crypto-native traders watching Bitget tokenized US equities who cannot babysit screens all weekend; they need an **explainable after-hours paper co-pilot**, not a 24/7 spam bot or mute HFT “decision chip.”
3. **Validation** — Paper trading log from competition window (timestamp, pair, side, qty, status, exchange orderId, why-hash). Metrics labeled observed / estimated / targeted. We do **not** invent closed Sharpe from open positions; accepted Demo fills + refuse rates are the honest scoreboard today.
4. **Progress** — Production TanStack Start UI + multitenant cookie sessions + Postgres/pglite journal + TinyFish news + Tor LLM policy + Bitget Demo paper executor + worker spine. Live e2e + UI demo recorded 2026-09-22.
5. **Deliverables** — Demo URL (Vercel/CF when promoted), GitHub `henrysammarfo/vigil`, exported paper log JSON, why-log replay, this pack, demo video artifact.
6. **AI Trading take** — Agents win when the **window is constrained** and **evidence is inspectable**. Mute microsecond models (see JEV trend) optimize latency; VIGIL optimizes **trust + closed-market edge** on Agent Hub paper.

---

## Story / fundamentals (fill the “why this exists”)

### Market problem
US cash equities sleep on nights/weekends. Bitget keeps **tokenized / Demo US-stock futures** trading. News still drops. Humans either miss it or over-trade noise. Generic AI bots trade 24/7 and cannot explain a NO.

### Product fundamental (one sentence)
**Closed-window event → observed rToken move → FENN allowlist → declared LLM → one paper side → append-only why.**

### Concept stack (judges can map)

| Concept | VIGIL meaning |
|---|---|
| Event-driven | TinyFish/Tavily headlines start the cycle — not a candle bot |
| Closed window | RTH open → standing down; after-hours / weekend only |
| FENN refuse-by-default | Empty allowlist = NO cards; headline ≠ fill |
| Observed vs estimated | Bitget public ticker move is `observed`; LLM rationale is labeled |
| Paper lock | `BITGET_PAPER=true` required; live path throws |
| Explainability | Hash-chained why-cards including refusals |
| Agent Hub alignment | Demo paper account is the trade to show |

### What we are **not**
- Not AXIS / Set.Forget.Earn copy
- Not a JEV-style mute HFT decision loop (complementary tech, different product)
- Not live-money advice; Demo paper only

---

## Paper book (as of 2026-09-22) — honest tally

### Accepted Demo fills (Bitget paper)

| # | When (UTC) | Symbol | Side | Status | Exchange orderId | Path |
|---|---|---|---|---|---|---|
| 1 | ~11:58 probe | NVDAUSDT | buy | accepted | `1486262952946679809` | Manual probe |
| 2 | 12:09 | NVDAUSDT | buy | accepted | `1486264474501758976` | CLI `e2e-full` + Tor LLM |
| 3 | 12:43 | NVDAUSDT | buy | accepted | (UI ledger) | Dashboard Run agent |
| 4 | 12:44 | AAPLUSDT | buy | accepted | (UI ledger) | Dashboard Run agent |

**Paper fills in:** **4** (all buys, Demo).  
**Closed wins / losses:** **0 tracked** — we have not flattened / marked-to-exit yet; do not claim Sharpe or win-rate from open Demo buys.  
**Refusals (product wins):** FENN one-side / allowlist NOs + signal WATCH under minConfidence — journal shows the discipline.

### “Wins” we *can* claim today
1. Live Tor → AgentRouter `deepseek-v4-flash` (re-probed OK 2026-09-22 22:39 UTC).
2. End-to-end closed-window → news → gates → Demo paper → why-hash.
3. Refuse-by-default demonstrated (empty allowlist / one-side / low conf → NO or WATCH).

### Lessons learned
1. **Demo key ≠ live key** — API key must be created inside Bitget Demo or `40099`.
2. **UTA v3 + `paptrading:1`** — classic mix endpoints fail Unified accounts.
3. **Demo symbols** — stock futures `NVDAUSDT` (not `rNVDAUSDT` / Reality spot).
4. **Signal gate ≠ LLM confidence** — Quiet mega-cap days need Watch+ to reach LLM; minConfidence applies at paper time.
5. **AgentRouter WAF** — Cursor cloud IPs get captcha; Tor SOCKS + node:https clears it; TinyFish Fetch 401 ≠ bad TinyFish key.
6. **JEV wave** — latency-first mute models are hot; VIGIL differentiates on **explainable closed-window paper**, not ms racing.

---

## X post checklist
- [ ] Quote https://x.com/Bitget_AI/status/2100519318824055159?s=20
- [ ] Include `#BitgetHackathon`
- [ ] Include `@Bitget_AI`
- [ ] Introduce VIGIL closed-window thesis (not a bare retweet)
- [ ] Link demo + GitHub

## Materials link bundle
- Demo: https://vigil-one-wine.vercel.app
- GitHub: https://github.com/henrysammarfo/vigil
- Demo video: `docs/submission/artifacts/vigil-s2-demo.mp4`
- Stampit pack: `docs/submission/STAMPIT_PACK.md`
- QA: `docs/submission/QA_REPORT.md` (56/56 PASS · 2026-10-06)
- Paper log: Dashboard → Paper trades → Export · artifacts `vigil-paper-log-*.json`
- Docs: `docs/memory/VIGIL_BIBLE.md`

## Deadline
**27 Sep 2026 UTC+8** (corrected from earlier 21 Sep draft)
