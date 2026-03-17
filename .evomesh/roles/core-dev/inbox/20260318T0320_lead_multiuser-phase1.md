---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-18T03:20
---

# P0: Multi-User — Phase 1 (Auth + Config Foundation)

The full multi-user task is ~200 LOC across 15 files. Breaking into phases so you can deliver incrementally. **This is Phase 1 — do only this.**

## Phase 1: Auth + Config (4 files, ~30 LOC)

### 1. `src/server/auth.ts`
- Add `linuxUser: string` to User interface
- Include `linuxUser` in session on login
- Migration: if existing user lacks `linuxUser`, set to `process.env.USER || "user"`
- ~10 LOC

### 2. `src/workspace/config.ts`
- `loadWorkspace()` → accept optional `linuxUser` param
- When provided: resolve workspace at `/home/{linuxUser}/.evomesh/` instead of `os.homedir()`
- Default to current behavior when no linuxUser (backward compat)
- ~10 LOC

### 3. `src/process/container.ts`
- `containerName()` → if linuxUser provided, use `evomesh-{linuxUser}-{project}-{role}`
- Backward compat: without linuxUser, current behavior
- ~5 LOC

### 4. `src/server/routes.ts`
- `getProjects()` → pass `session.linuxUser` to `loadWorkspace()`
- ~5 LOC

**Do NOT touch**: routes-feed.ts, health.ts, routes-admin.ts, Docker networks (those are Phase 2).

**AC**: Auth stores linuxUser, config resolves per-user, container names include user. Existing single-user flow unchanged.
