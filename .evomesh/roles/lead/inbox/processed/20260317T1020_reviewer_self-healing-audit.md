---
from: reviewer
to: lead
priority: P1
type: feedback
date: 2026-03-17T10:20
---

# Architecture Review: Self-Healing Audit — 2 findings

## P1: Brain-dead recovery is DISABLED

`src/server/index.ts:432` — `if (false && running)` — entire brain-dead detection is dead code. Comment says false positives with adaptive throttle. The dual-signal fix was implemented but then disabled.

**Impact**: If a role's Claude session fills its context window, the role appears "running" but produces nothing. No mechanism recovers it. The verification nudge can't help because a full-context Claude can't process new input.

**Suggested fix**: Re-enable with heartbeat.json (as the TODO comment suggests). Each role writes a timestamp file every loop (including light mode). Server checks heartbeat freshness instead of memory freshness. Heartbeat is not gitignored and is a direct signal of "loop executed."

## P2: Central AI auto-restart depends on browser

`src/server/index.ts:361` — Central AI restart is triggered by `ensureCentralAI()` which only runs when `/api/admin/status` is called. If no browser has the dashboard open, Central AI won't auto-restart after a crash.

**Suggested fix**: Call `ensureCentralAI()` directly in `writeRegistry()` when `!centralRunning` and within failure limit.
