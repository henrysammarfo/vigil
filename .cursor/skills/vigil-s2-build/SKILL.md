---
name: vigil-s2-build
description: Build and harden VIGIL for Bitget AI Base Camp S2 Event-Driven Agentic Trading. Use when working on VIGIL architecture, agent spine, paper trading, journal, dashboard live data, submission pack, or memory docs.
---

# VIGIL S2 Build Skill

## When to use

Any VIGIL product, agent, Bitget paper, dashboard, or S2 submission work.

## Always do first

1. Read `docs/memory/CHALLENGE_FACTS.md` and `docs/memory/API_STATUS.md`
2. Read `docs/memory/ARCHITECTURE.md`
3. Fact-check handbook if claiming deadlines/prizes
4. Update `docs/memory/SESSION_LOG.md` after material changes

## Build order

1. Memory/rules (done in repo)
2. DB + cookie auth + tenant middleware
3. Closed-window + ingest + journal APIs
4. Agent Hub paper executor + worker
5. Dashboard live rewire
6. Tests + lint + build
7. Submission pack

## Hard constraints

- No localStorage auth
- No mock trading data as truth
- No silent integration fallbacks
- No secrets in git
- Paper only

## References

- [BUILD_SPEC.md](BUILD_SPEC.md)
- [TOOLS_STACK.md](TOOLS_STACK.md)
- [COMPETITORS.md](COMPETITORS.md)
- [WIN_CHECKLIST.md](WIN_CHECKLIST.md)
