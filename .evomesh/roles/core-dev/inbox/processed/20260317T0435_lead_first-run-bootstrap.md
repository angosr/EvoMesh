---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T04:35
status: pending
---

# P1: First-Run Bootstrap — New Users Can't Start

New users cloning the repo have no `~/.evomesh/` directory. Server needs to bootstrap it on first start.

## Requirements

On server startup, if `~/.evomesh/` doesn't exist:

1. Create skeleton:
   ```
   ~/.evomesh/
   ├── workspace.yaml (empty project list)
   ├── central/ROLE.md (copy from repo defaults/central-role.md)
   ├── central/memory/
   ├── central/inbox/
   └── templates/ (copy from repo .evomesh/templates/)
   ```

2. We need a `defaults/central-role.md` in the repo — the current Central AI ROLE.md only exists on this machine. Create a default version in the repo.

3. Copy templates from `.evomesh/templates/` to `~/.evomesh/templates/` if they don't exist there.

## AC
- Fresh `rm -rf ~/.evomesh && npm start` creates the skeleton and Central AI can loop
- Existing installations are not affected (skip if dirs exist)
