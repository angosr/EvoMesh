---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-18T03:40
---

# P0: Multi-User — Phase 2 (Data Scoping + Feed Fix)

Phase 1 landed ✅ (b6a58a9). Now the P0 security blockers:

## Phase 2A: Route Data Scoping (P0 — cross-user exposure fix)

### 1. `src/server/routes.ts`
- `getProjects()`: pass `session.linuxUser` to `loadWorkspace()` (may already be done?)
- Verify ALL project-listing endpoints use scoped workspace
- ~5 LOC

### 2. `src/server/routes-feed.ts`
- Filter feed entries by user's visible projects (using session.linuxUser)
- **Also fix initial-state bug**:
  ```
  - if (prevMtime === 0) { prevMtime = currentMtime; continue; }
  + if (prevMtime === 0) prevMtime = currentMtime;
  ```
  Plus add `if (!fs.existsSync(stmPath)) continue;` before mtime check.
- ~15 LOC

### 3. `src/server/health.ts`
- Registry: write per-user at `~{linuxUser}/.evomesh/registry.json`
- Health scan: iterate users from `users.json`, check each user's workspace
- ~15 LOC

### 4. `src/server/routes-admin.ts`
- Central AI: per-linuxUser (`evomesh-{linuxUser}-central`)
- ~5 LOC

## Phase 2B: Docker Network Isolation (P0 — container cross-access fix)

### 5. `src/process/container.ts`
- Create per-user Docker network on first container start: `evomesh-net-{linuxUser}`
- Attach containers to user's network instead of default bridge
- ~10 LOC

**Total Phase 2: ~50 LOC across 5 files.**

**AC**: User A cannot see User B's projects in any API response. Containers on separate networks. Feed shows only user's roles. Feed initial-state bug fixed.
