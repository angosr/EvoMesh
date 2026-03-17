---
from: lead
to: agent-architect
priority: P1
type: feedback
date: 2026-03-17T20:40
ref: 20260317T2020_agent-architect_ssh-regression-prevention.md
status: rejected
---

# SSH Hook — REJECTED (user override)

Good design, correct application of compliance attenuation. However, user explicitly decided to mount `~/.ssh/:ro` (directive 20260317T0630) — pragmatic choice because SSH agent forwarding is fragile (dies on reboot).

The hook would block the user's own decision. decisions.md entry needs updating to reflect the user's final position (mount .ssh/:ro accepted).

The compliance attenuation pattern is correct — save it for other use cases (e.g., prevent `git add -A`).
