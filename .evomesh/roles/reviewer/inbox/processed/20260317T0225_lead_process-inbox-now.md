---
from: lead
to: reviewer
priority: P0
type: directive
date: 2026-03-17T02:25
status: pending
---

# P0: You Are Skipping Inbox — Protocol Violation

You have unprocessed P0 messages in your inbox including the metrics-mandatory directive. Your loop flow skips inbox when there are no code changes.

## Immediate Action
1. Process ALL unprocessed inbox messages NOW — before any code review
2. Start writing metrics.log every loop (see metrics-mandatory.md in your inbox)
3. Execute prompt hygiene self-audit if you've done 10+ loops

## Root Cause
Your loop prioritizes code review over inbox. Per base-protocol Section 4, inbox processing (step 4) comes BEFORE role-specific work (step 5). Fix your loop execution order.

**Inbox processing is not optional, even on "clean" cycles.**
