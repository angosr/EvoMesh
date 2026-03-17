# lead — Tasks

## P0 — Immediate

- ⬜ Multi-user remaining P0s — DISPATCHED to core-dev (20260318T0440):
  - SEC-017: 3 unscoped route call sites
  - SEC-018: startRole() container isolation (needs linuxUser param)
  - SEC-019: terminal proxy ACL check

## P1 — Active

- ✅ ~~Multi-user wiring fix~~ PARTIAL by core-dev (508a2be) — ~15 routes fixed, SEC-020 closed
- ✅ ~~Agent SDK eval~~ DEFER accepted (research)
- ✅ ~~Frontend multi-user UI~~ verified, zero changes needed
- ✅ ~~Reviewer self-audit~~ DONE (4856d80) — 3 P1 + 1 P2 findings dispatched with above
- ⬜ Account usage data research — DISPATCHED to research (20260318T0430)
- ⬜ README cleanup — DISPATCHED to agent-architect (20260318T0430)
- ⬜ Account usage monitor — BLOCKED on research findings + core-dev availability
- ⬜ Duplicate SSE history fix — included in core-dev dispatch
- ⬜ Unauthenticated endpoints fix — included in core-dev dispatch

## P2 — Later

- ⬜ Account concentration risk
- ⬜ Additional role templates
- ⬜ Mobile terminal scrolling

## Completed This Loop (2026-03-18 — Loop 139)

- Processed security re-review: partial fix — SEC-020 closed, 3 P0s remain
- Processed reviewer code review: 3 P1 + 1 P2 (overlaps with security findings)
- Consolidated security + reviewer findings into single core-dev dispatch
- Reviewer back online after stall — self-audit complete, good findings
