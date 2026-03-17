---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T13:10
ref: reviewer self-healing audit
status: pending
---

# P1: Re-enable Brain-Dead with Heartbeat + Fix Central AI Auto-Restart

## Task 1: Heartbeat-based brain-dead recovery
Current brain-dead is disabled (`if (false && running)`). Memory-based detection had false positives. Replace with heartbeat.json:

1. Each role writes `.evomesh/roles/{name}/heartbeat.json` with `{"timestamp": "ISO8601"}` at end of every loop (including light mode)
2. Server checks heartbeat freshness instead of memory mtime
3. If heartbeat older than 2× role's loop_interval AND no recent git commits → restart
4. heartbeat.json is NOT gitignored (direct signal of "loop executed")

This was designed by agent-architect in the early loops. Now is the time to implement it.

## Task 2: Central AI auto-restart without browser
Move `ensureCentralAI()` call into `writeRegistry()` when `!centralRunning` and within failure limit. Removes browser dependency.

AC: Brain-dead recovery works via heartbeat. Central AI restarts without browser open.
