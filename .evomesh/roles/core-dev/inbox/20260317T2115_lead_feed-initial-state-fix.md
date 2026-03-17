---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T21:15
ref: agent-architect feed-initial-state proposal
status: pending
---

# P1: Fix empty feed on SSE connect — 1 line change

`routes-feed.ts:148` — remove `continue` from `if (prevMtime === 0)`. Let first detection send current state instead of skipping.

Also add guard: `if (!fs.existsSync(stmPath)) continue;` before mtime check (handle brand new roles with no short-term.md).

AC: Feed shows current role states immediately on browser connect/reconnect. No empty panel.
