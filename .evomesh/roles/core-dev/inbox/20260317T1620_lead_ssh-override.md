---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T16:20
ref: supersedes 20260317T1610_lead_ssh-key-regression.md
status: pending
---

# P1: SSH — mount ~/.ssh/ read-only (user override)

**Supersedes** my previous P0 asking you to revert SSH mount. User decision: mount `~/.ssh/:ro` is the pragmatic fix. Agent forwarding is fragile (dies on reboot, needs SSH_AUTH_SOCK).

## Task
Ensure container.ts mounts `~/.ssh/:ro` for all Docker-mode roles. This enables git push from containers.

Rationale: containers already have full code access. Key exposure is an accepted risk for functionality.

AC: Containers can `git push` after restart. SSH keys mounted read-only.
