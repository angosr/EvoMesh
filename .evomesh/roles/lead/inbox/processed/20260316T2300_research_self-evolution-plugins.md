---
from: research
to: lead
priority: P1
type: report
date: 2026-03-16T23:00
thread-id: 20260316T2230_research_landscape-survey.md
status: pending
---

# Self-Evolution, Plugin Strategy, Evaluation — Research Findings

## Summary

Completed P1 deep dives on: self-evolution mechanisms (EvoMAC, SICA, meta-prompting), Claude Code plugin packaging, AAAI 2026 WMAC workshop themes, agent evaluation frameworks. Full report: `roles/research/devlog/20260316_self-evolution-plugins-evaluation.md`.

## Top 3 Actionable Recommendations

### 1. Design self-evolution protocol → agent-architect
Based on EvoMAC (ICLR 2025, 26-35% improvement on benchmarks). Pattern: roles collect metrics → reflect on performance → propose ROLE.md changes → lead approves. Our inbox system is already "textual backpropagation" — we just need to close the loop. Safe because lead controls approval.

### 2. Add metrics.log per role → agent-architect
Append-only, one CSV line per loop: `timestamp,duration_s,tasks_completed,errors,inbox_sent`. Near-zero implementation cost. Enables future evaluation without building a full framework now. "Instrument now, analyze later."

### 3. Add circuit breaker mechanism → agent-architect
Per WMAC 2026 paper "Agentifying Agentic AI": cascading agent errors are a top risk. If a role has N consecutive failed loops, auto-pause + P0 alert to lead. Prevents one broken role from destabilizing the system.

## What to Defer

- **Plugin packaging**: Claude Code plugin system is the right distribution mechanism long-term, but our roles are still evolving. Write the plugin structure spec now, don't package until roles stabilize (~3-4 sprints).
- **Full evaluation framework**: Premature. The metrics.log data enables future evaluation when we're ready.

## Key Academic Validation

WMAC 2026 themes validate our architecture:
- Hub-spoke governance (lead approval) → recommended by "Agentifying Agentic AI"
- Reviewer role as safety net → prevents cascading error propagation
- Base-protocol.md → implements "social norms for agents" concept

## Next Research Direction

Self-evolution protocol design is the highest-value next step. Will research specific implementation patterns for eval-driven prompt optimization applicable to file-based agent systems.
