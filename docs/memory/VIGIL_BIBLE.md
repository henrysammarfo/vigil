# VIGIL — Extreme Win Bible (MERGED · Bitget AI Base Camp S2)

> **Status:** Merged 2026-09-22 from Henry upload + live handbook fact-check  
> **Submit:** ≤ **27 Sep 2026 23:59 UTC+8** (upload still said 21 Sep — **wrong**; handbook wins)  
> **Handbook:** https://bitget-ai.gitbook.io/bitgetai_hackathons2/  
> **Track:** Agentic Trading · **Sub-theme:** Event-Driven Agent · paper on Agent Hub  
> **≠** AXIS · SLATE · RONIN · generic “AI trades NVDA”

---

## Soft

While the US market sleeps, VIGIL reads the headline and almost always papers nothing. It papers one rToken only when that token is named, the session is closed, and the allowlist says go.

## Unique job (not 24/7 spam bot)

**Closed-window rToken vigil with a FENN gate.**  
Research queues. The allowlist starts empty. A headline is not a fill.

**≠** Always-on sentiment bots · follow-the-leader Agent Hub copies · AXIS Set.Forget.Earn · RONIN (RYO venue).

**Organiser hero:** Bitget Agent Hub + `--paper-trading` + bitget-signal skills. Delete the paper account and there is no trade to show.

## What FENN actually printed (Delphi, closed 2026-08-25)

| Desk | End equity | vs 1000 |
|---|---:|---:|
| **FENN** | **2205.74** | **+1205.74** |
| LOCKIN | 1836.58 | +836.58 |
| VALE | 1238.49 | +238.49 |
| RIDGE | 1073.07 | +73.07 |
| SCOUT | halted mid-window | not the story |

Source (Henry-claimed; verify before pitch slides): `docs/memory/FINAL_RESULTS.md` · `agent/profiles/fenn/README.md` — **files not yet in this repo**; do not invent if missing at submit time.

## FENN → VIGIL (keep / drop)

| FENN gate | VIGIL |
|---|---|
| `REQUIRE_APPROVAL` + empty allowlist. No punch until the market is named. | No paper order unless the rToken is on the allowlist. Headline alone writes a **no**. |
| No follow-copy. RIDGE/VALE each ate ~400 TST copying BTC band o2. | Do not copy other Agent Hub agents or “top trader” feeds. |
| One structured side after research (Broncos 5+ No, LAFC 4+ No). | One side per name. Never paper both directions of the same rToken. |
| Isolated book. Paper until a human GO. | `--paper-trading` only. Main Bitget account stays disarmed. |
| Most cycles do nothing. The journal is the product. | Demo is ten headlines, nine refused cards, one paper with the why. |
| SCOUT spray, dual-side hedges, hunt-fast with ~6 left. | **Drop.** Fixed small paper size. No “use the rest of the balance.” |

## 8-second

Ten after-hours headlines. Nine cards say no, with the reason. One named rToken is on the allowlist → paper order → why-card.

## Pitch order

1. Closed-window thesis · 2. Agent Hub paper · 3. Explainability · 4. Metrics labeled · 5. X #BitgetHackathon

## Architecture

```
Headline
  → US session closed? else NO
  → rToken on allowlist? else NO (queued, not filled)
  → one side only
  → Agent Hub --paper-trading
  → append-only why-log (including the nos)
```

## Mandatory spine

Agent Hub MCP/CLI · paper account · closed-window clock · append-only journal · X post · LLM declared · ATU university field.

## Honesty

Paper only · no advice · never invent Bitget UID · metrics observed/estimated labeled · not unhackable.

## Identity

Henry Sam Marfo · @henrysammarfo · github.com/henrysammarfo

## Corrections log

| Field | Upload bible | Live handbook / merge |
| --- | --- | --- |
| Deadline | 21 Sep 2026 | **27 Sep 2026 UTC+8** |
| Sub-theme | Event-Driven | **Event-Driven Agent** |
| Soft / gate | FENN allowlist (keep) | Merged into this file |
| FENN equity table | Cited | Keep only if source files exist at pitch |
