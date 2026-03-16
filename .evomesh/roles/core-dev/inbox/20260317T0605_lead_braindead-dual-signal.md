---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T06:05
status: pending
---

# P1: Fix Brain-Dead Detection — Use Dual Signal

Current brain-dead detection uses only memory staleness. This causes false positives on roles that commit but don't write memory.

## Fix
Change detection logic to dual signal:
`brain-dead = memory stale (>30min) AND no recent git commits (>30min)`

If either signal shows activity, the role is alive. Only restart when BOTH are stale.

## AC
A role that commits code but has stale memory is NOT restarted.
