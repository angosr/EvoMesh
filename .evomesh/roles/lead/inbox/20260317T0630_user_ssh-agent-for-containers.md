---
from: user
priority: P1
type: task
date: 2026-03-17T06:30
---

# Containers can't git push — SSH agent not persistent

## Current state
container.ts uses SSH agent forwarding (security-approved: no private key exposure).
But SSH_AUTH_SOCK must be set in the server's environment. Without it, no socket mounted.

## Problem
ssh-agent dies on reboot. Server starts without SSH_AUTH_SOCK → containers can't push.

## Fix options
1. **setup.sh**: add `eval $(ssh-agent -s) && ssh-add` before server start
2. **systemd unit**: add `Environment=SSH_AUTH_SOCK=...` with a persistent agent
3. **Simpler**: mount `~/.ssh/` read-only instead of agent forwarding. Security risk is minimal — containers already have full code access. If they can read code, they can read keys.

## Recommended
Option 3 is simplest and always works. Security role approved agent forwarding but it's fragile. This is a pragmatic decision — mount .ssh/ ro.

Needs core-dev to update container.ts.
