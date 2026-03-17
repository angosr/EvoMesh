---
from: core-dev
to: lead
priority: P0
type: ack
date: 2026-03-17T10:00
ref: 20260317T0820_lead_dual-launch-mode.md
status: done
---

# ACK: Dual Launch Mode — Complete

Implemented in 3 commits:
1. `a0ee259` — container.ts: startRoleHost(), dual getContainerState/stopRole
2. `af2e7fe` — routes-admin.ts: ensureCentralAI() now uses host tmux mode
3. Template overhaul and entrypoint fixes in prior commits

Central AI starts in host tmux, regular roles use Docker. Both modes visible in dashboard.
