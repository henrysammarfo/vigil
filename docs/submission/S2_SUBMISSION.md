# VIGIL S2 Submission Pack

## Form fields (copy into Google Form)

### Track / theme
- Track: **Agentic Trading**
- Sub-theme: **Event-Driven Agent**
- University Name: **ATU**
- Apply for Demo Day: **Yes**
- Apply for K3 Token Subsidy: optional

### Role of the LLM
VIGIL scores closed-market events with a multi-path LLM gateway: AgentRouter primary (OpenAI-compatible `/v1/chat/completions` with allowlisted stainless/QwenCode headers, Anthropic Messages, optional local sync-Anthropic proxy at `AGENTROUTER_PROXY_URL`), Venice and DashScope/Qwen failover. Declared provider+model are sealed on every decision/why-card. FENN empty-allowlist refuses with deterministic `fenn-gate` NO cards and never calls the LLM. The LLM does not place live orders; Bitget Agent Hub Demo / `--paper-trading` executes paper only.

### Project description (six parts)

1. **Thesis** — While US RTH is closed, tokenized US stocks (rTokens) still move. VIGIL only activates in that closed window, verifies that news coincides with observed rToken movement, then papers a trade with a full why-log.
2. **Target user** — Retail / VIP crypto-native traders who already hold or watch Bitget tokenized US equities and cannot babysit screens all weekend; they need an explainable after-hours paper co-pilot, not a 24/7 spam bot.
3. **Validation** — Paper trading log from competition period (timestamp, pair, side, qty, status, why-hash). Metrics labeled observed/estimated/targeted. Win rate / drawdown reported only from observed paper fills.
4. **Progress** — Production TanStack Start UI + multitenant cookie sessions + Postgres journal + TinyFish/Tavily ingest + LLM policy + Bitget paper executor + Cloud Run worker.
5. **Deliverables** — Demo URL, GitHub repo, exported paper log JSON, why-log replay, this submission pack.
6. **AI Trading take** — Agents win when the window is constrained and evidence is inspectable; Bitget Agent Hub paper mode is the right rehearsal surface.

## X post checklist
- [ ] Quote https://x.com/Bitget_AI/status/2100519318824055159?s=20
- [ ] Include `#BitgetHackathon`
- [ ] Include `@Bitget_AI`
- [ ] Introduce VIGIL closed-window thesis (not a bare retweet)
- [ ] Link demo + GitHub

## Materials link bundle
- Demo: _(Cloudflare / production URL)_
- GitHub: https://github.com/henrysammarfo/vigil
- Paper log export: Dashboard → Paper trades → Export (see `docs/memory/BITGET_DEMO_STEPS.md`)
- Docs: `docs/memory/VIGIL_BIBLE.md`

## Deadline
**27 Sep 2026 UTC+8** (corrected from earlier 21 Sep draft)
