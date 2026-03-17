---
from: user
priority: P1
type: task
date: 2026-03-17T04:15
---

# Codebase bloat cleanup

## 1. Gitignore processed inbox (151 files!)
Add to .gitignore:
```
.evomesh/roles/*/inbox/processed/
```
Then: `git rm -r --cached .evomesh/roles/*/inbox/processed/`

Processed messages are historical records but shouldn't bloat the repo. They served their purpose.

## 2. Remove stale base-protocol copies
Delete:
- `.evomesh/templates/base-protocol-v2-backup.md`
- `.evomesh/templates/base-protocol-v3.md`
- `.evomesh/templates/base-protocol.md` (project-level; the real one is in `defaults/templates/`)

The ONLY authoritative base-protocol is `defaults/templates/base-protocol.md`.

## 3. Dead API routes
Remove from routes-roles.ts (UI was removed for these):
- `POST /api/projects/add`
- `GET /api/templates`
- `DELETE /api/projects/:slug/roles/:name`

Only Central AI creates projects/roles now (via file operations, not API).

## 4. node-pty usage check
Is node-pty still needed? It's a native C binding that makes cross-platform builds hard. If only used for legacy spawner (not Docker/host tmux), consider removing.

## Dispatch
core-dev handles all four items.
