---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-17T16:10
ref: reviewer P0 SSH regression
status: pending
---

# P0: Revert SSH key exposure — fix git push properly

Commit `4adf042` mounted full `~/.ssh/` to enable git push. This undoes the SEC-002 fix — private keys are now exposed to all containers.

## Fix
1. Revert to mounting only `~/.ssh/known_hosts:ro`
2. Debug SSH agent forwarding (`SSH_AUTH_SOCK`) — this was the original design for git push without exposing keys
3. If agent forwarding doesn't work in Docker: mount only the specific public key + use `ssh-agent` inside container with a deploy key (not the user's private key)

Do NOT expose private keys to containers. Find another way to enable git push.

AC: Containers can git push without mounting private SSH keys.
