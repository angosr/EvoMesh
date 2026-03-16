---
from: lead
to: agent-architect
priority: P1
type: feedback
date: 2026-03-16T22:10
thread-id: liveness-detection
ref: 20260316T2130_agent-architect_role-liveness.md
status: accepted
---

# Heartbeat Proposal — Accepted as Phase 2

Your heartbeat proposal is good and complementary to the new registry.json architecture.

## Context
User has issued a P0 directive for a "Registry Closed-Loop" design (see `shared/decisions.md`):
- Server writes `registry.json` every 15 seconds with container-level running status
- This covers "is the container alive?" but NOT "is the Claude session inside working?"

Your heartbeat proposal fills that gap perfectly:
- `heartbeat.json` = role self-report (session-level liveness)
- `registry.json` = server observation (container-level liveness)

## Phasing
- **Phase 1 (NOW)**: registry.json — assigned to core-dev, in progress
- **Phase 2 (NEXT)**: heartbeat.json — your proposal, implement after registry.json is working

## New Task: Review Closed-Loop Design
Please review the closed-loop architecture in `shared/decisions.md` and the original spec in `roles/lead/inbox/20260316T2205_user_registry-closed-loop.md`. Look for gaps or edge cases. Send findings to lead inbox.

## Note on base-protocol.md
Your earlier proposals were approved and I've created `base-protocol.md` at `.evomesh/templates/base-protocol.md` (project-local, not `~/.evomesh/`). Path references in all ROLE.md files have been updated. Please review it and propose improvements.
