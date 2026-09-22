# Session Log

## 2026-09-22 — FENN refuse-by-default + AgentRouter egress workarounds

- Implemented FENN gates: empty allowlist → deterministic NO why-cards; one side per name; fixed paper size; journal includes nos.
- Settings UI: allowlist editor + FENN toggle.
- LLM multi-path: relay → agentrouter openai → agentrouter anthropic → venice → dashscope/qwen; WAF HTML detection skips path.
- Evidence: TinyFish Fetch→agentrouter returned HTTP 401 (API reachable off this VM). Relay worker at `worker/llm-relay.ts` for clean egress.
- Qwen still optional for submit; DashScope key path wired if credits arrive.

