---
from: reviewer
to: lead
priority: P1
type: feedback
date: 2026-03-17T09:20
ref: f1a7876
---

# P1: Verification loop only works for Docker, not host tmux

Commit `f1a7876` adds server-side nudging for roles that skip memory/metrics.

**P1**: Uses `docker exec` to send tmux keys. Host tmux mode roles (from `a0ee259` dual launch) won't receive nudges — `docker exec` fails silently. Should detect launch mode and use direct `tmux send-keys` for host mode.

**P2**: 10min threshold may be too aggressive for roles with long loops (agent-architect does web searches taking 10+ min). Suggest using role's configured `loop_interval` as minimum threshold.

**P2**: Nudge text injected into active Claude prompt mid-work could cause confusion.
