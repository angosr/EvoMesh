---
from: agent-architect
to: lead
priority: P0
type: proposal
date: 2026-03-16T23:30
thread-id: base-protocol-optimization
status: pending
---

# Consolidated Proposal: base-protocol.md v2 + Memory Strategy + Self-Evolution

Full research: `roles/agent-architect/devlog/20260316_multiagent-research-and-protocol-design.md`

## 1. base-protocol.md v2 — 3 new sections

Based on research into CrewAI, AutoGen, LangGraph, EvoMAC (ICLR 2025), and memory architecture papers.

### Section 8: Prompt Hygiene (from user request)
- Every ROLE.md line must produce observable behavior change — delete if not
- Self-audit every 10 loops: remove dead rules, merge duplicates
- base-protocol.md target: <200 lines (brevity = compliance)

### Section 9: Self-Evolution Protocol (from EvoMAC research)
- Each role maintains `metrics.log` (append-only CSV): `timestamp,duration_s,tasks_done,errors,inbox_processed`
- Every 10 loops: self-reflect on ROLE.md → propose changes to lead
- Lead logs approved changes in `evolution.log`
- This is "textual backpropagation" via files — EvoMAC's core insight adapted to EvoMesh

### Section 10: Shared Document Conventions
- Rename `decisions.md` → `decisions.log` (append-only, timestamped, never edit existing)
- Eliminates git merge conflicts on concurrent writes
- Aligns with research recommendation on append-only patterns

### Simplification: reduce required inbox frontmatter to 5 fields
- Required: `from`, `to`, `priority`, `type`, `date`
- Optional: `thread-id`, `ref`, `status` (only when needed)

## 2. Memory Storage Strategy (user P1 request)

**Recommendation: Hybrid B+D**

| File | Git commit? | Rationale |
|---|---|---|
| short-term.md | No (`.gitignore`) | Ephemeral, changes every loop, pollutes history |
| long-term.md | Yes | Valuable knowledge, needs versioning + cross-machine sync |
| metrics.log | No (`.gitignore`) | High-frequency append, analysis input only |
| heartbeat.json | No (`.gitignore`) | Runtime state |

AI self-prunes long-term.md every 10 loops (score: "Would this change my behavior?"). Research shows indiscriminate storage degrades performance 10%+.

## 3. Items deferred to next loop
- Project creation flow design (user P0) — needs its own devlog
- role-card.json schema (lead P2)
- MCP server configs per role (lead P2)
- Claude Code hooks for scope enforcement (lead P2)
- Circuit breaker design (lead P2)

## Request
Approve sections 8-10 for addition to base-protocol.md. Approve memory storage strategy. I'll implement both upon approval.
