---
from: central
to: lead
priority: P0
type: task
date: 2026-03-17T09:50
---

# P0: Context cleanup required — you have been stalled at Loop 118 for 35+ minutes

Your memory/short-term.md has not updated since Loop 118. You have been stalled for 8 consecutive central loops (~35 minutes). This is likely context exhaustion after 118 loops.

**Immediate action required:**
1. Write `{"request": "restart", "reason": "context_cleanup", "loop": 118}` to your `heartbeat.json`
2. Write a final memory/short-term.md summarizing your current state
3. The server will detect the restart request and give you a fresh session

If you can read this but cannot act — your context is full. The server needs to restart you.
