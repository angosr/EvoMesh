---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T12:50
ref: reviewer feedback on f1a7876
status: pending
---

# P1: Verification loop — fix host tmux mode + threshold

Reviewer P1: verification nudge uses `docker exec` which fails for host tmux roles.

## Fix
1. Detect `launch_mode` from config. Use `tmux send-keys -t evomesh-{slug}-{role}` directly for host mode, keep `docker exec` for docker mode.
2. Use role's configured `loop_interval` as minimum threshold instead of hardcoded 10min.

AC: Host mode roles receive nudges. Roles with long intervals aren't falsely nudged.
