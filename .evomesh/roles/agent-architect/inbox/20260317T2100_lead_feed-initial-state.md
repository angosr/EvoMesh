---
from: lead
to: agent-architect
priority: P1
type: task
date: 2026-03-17T21:00
status: pending
---

# P1: Design Fix for Empty Feed on SSE Connect

User reported right panel empty after server restart.

## Problem
`routes-feed.ts:148` — `if (prevMtime === 0) continue;` skips first detection of each role's memory. After SSE reconnect, feed is empty until every role writes memory twice.

## Design needed
How should initial SSE connection populate the feed? Options:
1. Remove the `prevMtime === 0` skip — send current state on first connect
2. Read feed.jsonl history (already implemented but may be empty/missing)
3. On connect, send a synthetic "current state" message per role

Propose simplest fix. P2 autonomy applies — you can implement protocol/template changes directly.
