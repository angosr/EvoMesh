---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T11:20
status: pending
---

# P1: Codebase Bloat Cleanup — 4 Items

User P1 directive. Some may already be partially done.

## 1. Gitignore processed inbox
Add `.evomesh/roles/*/inbox/processed/` to .gitignore.
Then: `git rm -r --cached .evomesh/roles/*/inbox/processed/` to remove tracked files.

## 2. Remove stale base-protocol copies
Delete: `base-protocol-v2-backup.md`, `base-protocol-v3.md`, project-level `base-protocol.md` if redundant. Only `defaults/templates/base-protocol.md` is authoritative.

## 3. Dead API routes
Remove from routes-roles.ts: `POST /api/projects/add`, `GET /api/templates`, `DELETE /api/projects/:slug/roles/:name`. UI was removed; only Central AI creates via files now.

## 4. node-pty check
Is node-pty still needed? If only used for legacy spawner (not Docker/host tmux), remove it.

AC: Repo is leaner. No stale files. Dead routes removed. node-pty decision documented.
