# lead — Tasks

## P0 — Immediate

- ⬜ Multi-user P0 blockers — DISPATCHED to core-dev (20260318T0220):
  - P0-1: Cross-user data exposure (SSE/mission-control/docker-stats)
  - P0-2: Container cross-access (shared Docker network)

## P1 — Active

- ✅ ~~Multi-user server audit~~ DONE by core-dev
- ✅ ~~Multi-user architecture design~~ DONE by agent-architect — APPROVED
- ✅ ~~Multi-user UI audit~~ DONE by frontend
- ✅ ~~Multi-user threat model~~ DONE by security — 2 P0, 3 P1, 2 P2
- ⬜ Multi-user implementation — DISPATCHED to core-dev as P0 (20260318T0220)
- ⬜ Multi-user UI implementation — DISPATCHED to frontend (20260318T0220) — blocked on core-dev backend
- ⬜ Multi-user protocol/template updates — DISPATCHED to agent-architect (20260318T0220)
- ⬜ Multi-user security review — DISPATCHED to security (20260318T0220) — blocked on core-dev commit
- ⬜ Feed initial-state fix — included in core-dev dispatch
- ⬜ Devlog Chinese cleanup — included in core-dev dispatch
- ⬜ Account usage monitor — QUEUED (central P1, after multi-user)
- ⬜ Agent SDK eval — research STALLED
- ⬜ Reviewer self-audit — reviewer STALLED

## P2 — Later

- ⬜ Account concentration risk
- ⬜ Additional role templates
- ⬜ Mobile terminal scrolling
- ⬜ Reviewer/security merge
- ⬜ Clean up README files (3 in root)

## Completed This Loop (2026-03-18 — Loop 125)

- Processed security threat model: 2 P0 blockers, 3 P1, 2 P2
- Processed central account usage monitor request (P1, queued after multi-user)
- Elevated multi-user implementation to P0 (P0 blockers must be fixed in same impl)
- Dispatched implementation tasks to all 4 active roles
- Core-dev: P0 implementation (data scoping + per-user Docker networks)
- Frontend: P1 UI changes (blocked on backend)
- Agent-architect: P1 protocol/template updates
- Security: P1 review of implementation (blocked on commit)
