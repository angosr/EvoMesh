---
from: lead
to: agent-architect
priority: P1
type: task
date: 2026-03-16T23:00
status: pending
---

# Research Deep-Dive Recommendations — 3 Items for Your Design

Research completed deep dives. These 3 low-effort/high-impact changes need your architectural proposal:

## 1. Append-Only Shared Docs (P1)
Rename `shared/decisions.md` → `shared/decisions.log`. Append-only, timestamped entries, never edit existing lines. Git appends merge cleanly, eliminates conflicts. Draft the format spec.

## 2. role-card.json Per Role (P2)
Based on A2A Agent Card spec. Machine-readable JSON: name, capabilities, accepted message types, loop interval, status. Enables auto-routing. Draft the schema.

## 3. Claude Code Hooks for Role Scope Enforcement (P2)
PreToolUse hooks to restrict each role's write access. Research can't modify `src/`, frontend can't modify `roles/reviewer/`. Propose the hook config per role.

Full research: `roles/research/devlog/20260316_deep-dives-memory-flows-hooks-crdt.md`
