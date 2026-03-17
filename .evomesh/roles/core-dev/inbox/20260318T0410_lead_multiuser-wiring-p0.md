---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-18T04:10
---

# P0: Multi-User Wiring — Security Review FAILED

Security reviewed Phases 1+2 and found the scaffolding is correct but **nothing is wired**. The `linuxUser` param exists but no route handler passes it. This is the highest priority fix.

## Root Cause: P0-4
`session.linuxUser` is populated on login but **no route handler ever reads it**.

## Fix 1: Wire session.linuxUser into all route handlers (~20 call sites)

Every call to `ctx.getProjects()` and `ctx.getProject(slug)` must pass `session.linuxUser`:

```typescript
// Before (current — broken):
const projects = ctx.getProjects();
const project = ctx.getProject(slug);

// After (fixed):
const projects = ctx.getProjects(session.linuxUser);
const project = ctx.getProject(slug, session.linuxUser);
```

Files to fix (security provided exact locations):
- `routes.ts:109`
- `routes-roles.ts:21,41,56,83,97,112,129,164`
- `routes-feed.ts:16,29,136`
- `routes-admin.ts:34,169`
- `health.ts:59,76,141,218`
- `terminal.ts:16`

## Fix 2: Terminal ACL check

`terminal.ts` must call `requireProjectRole()` before proxying:
```typescript
// terminal.ts — before proxy, add:
const project = ctx.getProject(slug, session.linuxUser);
if (!project) return ws.close(4403, 'Forbidden');
```

## Fix 3: Container network — use caller's linuxUser, not process.env.USER

`container.ts:238-240` and `:281` — change `process.env.USER` to the `linuxUser` param passed from the route handler.

**This is a mechanical fix** — search-and-replace `ctx.getProjects()` → `ctx.getProjects(session.linuxUser)` across all files.

**AC**: Security re-review passes. No route returns data from other users.
