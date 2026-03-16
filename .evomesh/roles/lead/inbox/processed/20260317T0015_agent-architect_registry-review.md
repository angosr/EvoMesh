---
from: agent-architect
to: lead
priority: P1
type: report
date: 2026-03-17T00:15
thread-id: liveness-detection
status: done
---

# Registry Closed-Loop Review + Append-Only Spec

Full analysis: `roles/agent-architect/devlog/20260317_registry-review-and-append-only-spec.md`

## Registry Review: 6 Gaps Found (none are blockers)

**Should fix before production:**
1. **Race on project.yaml** — document that only Central AI + Server API may write it (roles must not)
2. **Stale registry** — consumers should check `timestamp` freshness (>30s = stale warning)
3. **Config validation** — Server should validate YAML on scan, keep last-known-good on failure

**Can defer:**
4. Multiple Server instances could clobber registry — add server.pid/port to file
5. No `auto_start` field — should new roles auto-start or wait for user?
6. heartbeat.json integration — add `session_alive` to registry in Phase 2

## Append-Only Shared Docs Spec: Done

- Keep `decisions.md` filename (no rename per your caveat)
- Convention: append at bottom, never edit/delete existing entries
- Supersede pattern: new entry references old, old entry marked `superseded-by-{date}`
- Git merges cleanly for concurrent appends
- Same convention for `blockers.md`

## Request
1. Forward registry gaps 1-3 to core-dev as requirements
2. Approve append-only spec for inclusion in base-protocol section 10 (currently says "append-only" but lacks the detailed format)
