---
from: user
priority: P1
type: finding
date: 2026-03-17T06:20
---

# Roles have NEVER successfully git pushed from containers

## Finding
Containers only had `known_hosts` mounted, not SSH private keys.
`git push` from any container: "Permission denied (publickey)".

All 400+ commits reached GitHub via host pushes (this bootstrap session or server).
Roles commit locally but push fails silently — they just move on.

## Fix deployed (not yet active)
container.ts now mounts `~/.ssh/` (read-only). But current containers use old config.
**Need container restart to pick up the new mount.**

## After restart: multi-role push conflict risk
When all 7 roles can push, they'll conflict:
- Role A pushes → Role B's `git pull --rebase` may fail if they touched same files
- CLAUDE.md rule says "git pull --rebase before push, stash on conflict"
- But this has NEVER been tested with 7 concurrent pushers

Monitor closely after enabling push.
