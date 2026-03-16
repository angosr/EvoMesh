# lead — Tasks

## P0 — Immediate

ALL P0 COMPLETE ✅

## P1 — Active

- ⬜ Monitor core-dev: smartInit() migration (templates now available, dispatched last loop)
- ✅ Agent-architect deferred items: ALL DESIGNED AND APPROVED (role-card, MCP, circuit breaker, AC format)
- ⬜ Evaluate Agent SDK for intra-role parallelism (research P2 rec)
- ⬜ Verify all roles writing memory per protocol (was a violation myself — now fixed)

## P2 — Later

- ⬜ Additional role templates (security, frontend, research .tmpl files)
- ⬜ Mobile terminal scrolling
- ⬜ Container interval restart — user decision

## Completed This Loop (2026-03-17T01:05)

- Approved Claude Code hooks scope enforcement (P2) — all agent-architect design items now complete
- Quiet loop, system in implementation phase

## Previous: Loop 18 (2026-03-17T00:55)

- CRITICAL: Updated base-protocol git flow (user P0) — prohibit `git add -A`, require pull --rebase before push, stash retry on failure
- This fixes the last structural bootstrap defect: roles can now push independently without external cleanup session

## Previous: Loop 17 (2026-03-17T00:45)

- Approved circuit breaker (base-protocol section 11) + fetch-mcp for research
- ALL 10 research recommendations now fully designed and approved
- Agent-architect backlog cleared — 4 proposals in 4 consecutive loops

## Previous: Loop 16 (2026-03-17T00:35)

- Approved agent-architect: task acceptance criteria format + role-card.json schema
- Noted core-dev closed all 3 registry gaps in one commit (fast turnaround)
- Agent-architect throughput: 3 proposals in 3 consecutive loops (protocol v2, project creation, AC+role-card)

## Previous: Loop 15 (2026-03-17T00:25)

- Reviewed agent-architect registry closed-loop review: 6 gaps found, none blockers
- Forwarded gaps 1-3 to core-dev (project.yaml race, stale detection, config validation)
- Approved append-only spec for base-protocol section 10 (agent-architect can update directly)
- Reviewer now writing memory — protocol compliance spreading across roles
- Wrote short-term.md (maintaining compliance)

## Previous: Loop 14 (2026-03-17T00:15)

- FIXED memory violation: wrote short-term.md, updated ROLE.md loop flow to mandate memory read+write + decisions.md reading
- Confirmed agent-architect template files delivered (6 .tmpl files in place)
- Noted core-dev can now begin smartInit migration (templates available)
- Frontend shipped: dark/light theme toggle, swipe-to-close
- Security verified clean scan, reviewer review #010 clean
- Updated ROLE.md Project-Specific Rules: phase → Self-Evolution, removed stale blocker

## Previous Loops
### Loop 13 — Idle, system steady
### Loop 12 — Approved project creation flow, dispatched smartInit
### Loop 11 — Approved protocol v2, phase transition
### Loop 10 — Routed final research batch
### Loops 1-9 — Bootstrap through collaboration establishment
