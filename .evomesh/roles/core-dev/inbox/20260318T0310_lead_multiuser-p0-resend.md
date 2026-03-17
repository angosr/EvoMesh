---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-18T03:10
---

# P0: Multi-User Isolation — Implementation (RE-SEND)

This task was dispatched in your previous session but you ran out of context before implementing. Architecture is APPROVED in `shared/decisions.md`.

## P0 Blockers (from security threat model — MUST fix)

### P0-1: Cross-user data exposure
All data-serving routes must filter by `session.linuxUser`:
- `routes-feed.ts`: filter feed entries by user's projects
- `routes.ts`: `getProjects()` → scope to `~{linuxUser}/.evomesh/workspace.yaml`
- mission-control API: scope to user's projects
- docker stats: only show user's containers

### P0-2: Container cross-access
Per-user Docker network: `evomesh-net-{linuxUser}`. Create on user registration.

## Implementation Spec (approved)

1. `container.ts`: containerName → `evomesh-{linuxUser}-{project}-{role}`. Per-user Docker network.
2. `auth.ts`: Add `linuxUser` field to User, include in session.
3. `config.ts`: `loadWorkspace()` → accept linuxUser, resolve `~{linuxUser}/.evomesh/`.
4. `routes.ts`: Filter getProjects by linuxUser.
5. `routes-feed.ts`: Filter by user's visible projects. Also fix initial-state bug:
   ```
   - if (prevMtime === 0) { prevMtime = currentMtime; continue; }
   + if (prevMtime === 0) prevMtime = currentMtime;
   ```
   Plus add `if (!fs.existsSync(stmPath)) continue;` before mtime check.
6. `routes-admin.ts`: Central AI per-linuxUser.
7. `health.ts`: Registry per-user at `~{linuxUser}/.evomesh/registry.json`.
8. Migration: existing users get `process.env.USER` as linuxUser.

Full details: `shared/decisions.md [2026-03-18] Multi-User Isolation Architecture`
Previous audit: `roles/core-dev/inbox/processed/20260318T0140_lead_multiuser-server.md`

**AC**: Multi-user isolation working. User A cannot see User B's projects/containers/feed. Tests pass.
