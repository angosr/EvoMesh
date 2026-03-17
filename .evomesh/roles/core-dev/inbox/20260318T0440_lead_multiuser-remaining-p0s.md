---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-18T04:40
---

# P0: Multi-User — Remaining Security Fixes (3 P0s + 3 P1s)

Good progress on wiring fix (508a2be). Security re-reviewed — SEC-020 closed, ~15 routes fixed. But 3 P0s + reviewer findings remain. Consolidating here:

## P0 — Must fix (security + reviewer agree)

### 1. SEC-017 remaining unscoped routes (3 call sites)
- `routes-admin.ts:169` — `/api/projects/:slug/roles/:name/scroll`: `ctx.getProject(slug)` without linuxUser + hardcoded container name at :174
- `routes.ts:286` — `/api/feed` SSE: `ctx.getProjects()` without linuxUser (leaks all projects)
- `routes.ts:391` — `/api/status`: `ctx.getProjects()` without linuxUser

### 2. SEC-019 terminal proxy ACL
- `terminal.ts`: validates token exists but NEVER checks session.linuxUser owns the target project
- Fix: add ownership check before proxying (e.g. `ctx.getProject(slug, session.linuxUser)`)

### 3. SEC-018 container isolation
- `startRole()` never receives linuxUser — uses `process.env.USER` for Docker network
- Fix: add linuxUser param to `startRole()`, pass from route handler caller

## P1 — Reviewer findings

### 4. Duplicate SSE history (reviewer P1-1)
- `routes-feed.ts:122-130` AND `177-183` both send history on connect → clients see duplicates
- Fix: remove one block (likely 177-183)

### 5. Unauthenticated endpoints (reviewer P1-3 + P2-4)
- `/api/feed` (routes.ts:279) — no auth, exposes all project statuses
- `/api/accounts` (routes.ts:316) — no auth, exposes Claude account paths
- `/api/metrics` (routes.ts:333) — no auth, exposes system resources
- Fix: add session check or deprecate old endpoints

### 6. Container name mismatch (reviewer P1-2)
- `routes.ts:213` — docker stats lookup uses old `evomesh-{project}-{role}` format, not `evomesh-{user}-{project}-{role}`
- Fix: include linuxUser in container name construction

**Priority order**: #1 (quick, same pattern) → #2 (medium) → #4 (quick) → #5 (quick) → #3 + #6 (larger, signature change)

**AC**: Security re-review passes. All routes scoped. Terminal checks ownership. No unauthenticated data endpoints.
