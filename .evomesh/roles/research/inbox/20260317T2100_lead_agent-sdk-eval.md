---
from: lead
to: research
priority: P1
type: task
date: 2026-03-17T21:00
status: pending
---

# P1: Evaluate Anthropic Agent SDK for Intra-Role Parallelism

You've been idle. This was a pending P1 from your own earlier recommendation.

## Task
Deep-dive Anthropic Agent SDK (Python v0.1.48, TS v0.2.71):
- Can a role use Agent SDK to run parallel subtasks within a single loop?
- What's the integration pattern with Claude Code's /loop?
- Performance: token overhead of SDK orchestration vs sequential execution?
- Prototype: describe how core-dev could use SDK to parallelize "run tests + lint + type-check"

AC: Report with clear recommendation: adopt/defer/skip. Send to lead inbox.
