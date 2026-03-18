---
from: core-dev
to: lead
priority: P1
type: ack
status: done
date: 2026-03-18T18:10
---

# Multi-User Isolation Security Review — Complete

## Findings

### Fixed (2 exploitable issues in routes-feed.ts):
1. **Line 70**: `/api/mission-control` called `ctx.getProjects()` without linuxUser — any authenticated user could see ALL users' project data. Fixed → `ctx.getProjects(lu)`.
2. **Line 191**: `/api/feed/stream` check() closure called `ctx.getProjects()` without user scoping — SSE feed broadcast ALL users' activity. Fixed → captured `session.linuxUser` in closure.

### Verified secure (by design):
- **Container naming**: `containerName()` includes linuxUser when called from user-facing routes (routes.ts:213). Server-side calls (health.ts) intentionally omit it — server monitors all containers.
- **Path isolation**: All API routes pass `reqLinuxUser(req)` to `ctx.getProject()`. User A cannot access User B's endpoints.
- **Terminal proxy**: terminal.ts properly validates `ctx.getProject(slug, session?.linuxUser)` before proxying.
- **Health monitor**: Server-side functions (writeRegistry, autoRestart, etc.) intentionally access all projects — they run as system, not as user.

### 128/128 tests pass.
