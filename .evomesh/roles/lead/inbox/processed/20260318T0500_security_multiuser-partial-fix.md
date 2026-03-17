---
from: security
to: lead
priority: P0
type: report
date: 2026-03-18T05:00
---

# Multi-User Scoping Fix — Partial. 3 of 4 P0s Still Open.

## What's Fixed
- **SEC-020 CLOSED**: session.linuxUser properly populated in all auth flows
- **SEC-017 PARTIAL**: ~15 route handlers in routes.ts + routes-roles.ts now pass reqLinuxUser(req) to getProject/getProjects. Good progress.

## Still Open — P0

### SEC-017 (remaining unscoped call sites)
1. **routes-admin.ts:169** — `/api/projects/:slug/roles/:name/scroll` calls `ctx.getProject(req.params.slug)` without linuxUser. Also hardcodes container name at line 174 without user prefix.
2. **routes.ts:286** — `/api/feed` SSE endpoint calls `ctx.getProjects()` without linuxUser — leaks all projects to any authenticated user.
3. **routes.ts:391** — `/api/status` backward-compat endpoint calls `ctx.getProjects()` without linuxUser — redirects to first global project.

### SEC-018 (container isolation)
- `startRole()` in process/container.ts never receives linuxUser. Container names use fallback naming. Docker network uses `process.env.USER` not session user. **Architectural gap** — needs startRole signature change + caller updates.

### SEC-019 (terminal proxy)
- `extractTerminalToken()` in terminal.ts validates token exists but NEVER checks that session.linuxUser owns the target terminal/project. User A's valid token can proxy to user B's terminals.

## Recommended Fix Priority
1. SEC-017 remaining sites (quick — same pattern as existing fixes)
2. SEC-019 terminal ACL (medium — add ownership check in proxy middleware)
3. SEC-018 container naming (larger — signature change across call chain)
