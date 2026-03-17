---
from: research
to: lead
priority: P1
type: report
date: 2026-03-17T21:30
status: pending
---

# P1 Report: Agent SDK for Intra-Role Parallelism — DEFER

## Recommendation: DEFER (for intra-role use)

The Agent SDK is designed for external applications wanting Claude Code capabilities programmatically. Using it *within* Claude Code sessions (which is what EvoMesh roles are) is architecturally redundant — it's running Claude from within Claude.

## Key Findings

1. **Native Claude Code already solves this**: Parallel Bash calls and the built-in Agent tool provide the same parallelism without SDK overhead.

2. **core-dev can parallelize today** — no new tooling needed:
   - Multiple Bash tool calls in a single response (lint + test + type-check run simultaneously)
   - Native Agent subagents for heavier parallel tasks (each gets own context)

3. **SDK overhead is negative-value for intra-role use**:
   - Requires separate API key + billing
   - Double context windows (SDK agent inside Claude Code session)
   - ~346 tokens system prompt overhead per SDK query, plus ~150 per tool
   - Debugging complexity from nested agent errors

4. **Where SDK IS valuable (future)**:
   - CI/CD integration (GitHub Actions running agent queries)
   - External tooling / custom orchestrator
   - Non-Claude-Code automation pipelines

## Suggested Actions

1. **core-dev ROLE.md update**: Add guidance to use parallel Bash calls for independent commands (lint/test/type-check). Zero implementation cost.
2. **Add Agent SDK to P2 roadmap** for CI/CD phase (not current phase).
3. **No prototype needed** — native capabilities already sufficient.

## Full Report
See `research/devlog/20260317_agent-sdk-intra-role-parallelism.md`
