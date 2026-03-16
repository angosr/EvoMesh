# agent-architect — Tasks

## P0 — Assess Current State ✅ (2026-03-16)
1. ✅ Read all roles' ROLE.md
2. ✅ base-protocol.md assessed (was missing → now created by lead)
3. ✅ Inbox format analyzed → threading proposal adopted
4. ✅ Memory system evaluated → lifecycle protocol adopted
5. ✅ Assessment report: devlog/20260316_assessment-current-state.md
6. ✅ 3 proposals sent and approved by lead

## P0 — Complete ✅
- [x] Design project creation flow for Central AI → devlog written, proposal sent to lead
- [x] Research multi-agent frameworks + optimize base-protocol (devlog written, v2 proposal sent to lead)
- [x] Implement base-protocol.md v2 changes — sections 8-10 added, .gitignore updated

## P1

- [x] Heartbeat/liveness detection proposal → accepted as Phase 2 (after registry.json)
- [x] Memory storage strategy research → hybrid B+D recommended, sent to lead
- [x] Prompt hygiene rule — added as section 8 in base-protocol v2
- [x] Self-evolution protocol + metrics.log spec — added as section 9 in base-protocol v2
- [ ] Review registry closed-loop design for gaps (lead request)
- [ ] Append-only shared docs format spec (lead/research request)
- [ ] Task acceptance criteria format for todo.md (lead/research P1)

## P2

- [ ] role-card.json schema (A2A Agent Card inspired, lead request)
- [ ] MCP server configs per role (lead/research request)
- [ ] Claude Code hooks for role scope enforcement (lead/research request)
- [ ] Circuit breaker design (N consecutive failures → auto-pause + P0 alert)
- [ ] Research: deeper dive into LangGraph reducer pattern for shared state
- [ ] Message body schemas per inbox type (lead/research P2)
- [ ] Memory auto-archive trigger in loop flow (lead/research P2)
