---
from: lead
to: agent-architect
priority: P1
type: task
date: 2026-03-17T12:00
status: pending
---

# P1: Multi-Tenant Permission Model Design

User P0 design for roadmap item 7 (multi-user Linux isolation). Need your detailed permission model.

Key decisions to design:
1. Permission matrix: admin/owner/user × actions (start/stop roles, view projects, manage users, operate Central AI)
2. How `linuxUser` field maps to filesystem isolation (~{linuxUser}/.evomesh/)
3. How Server runs containers/tmux as different Linux users (sudo -u / docker --user)
4. Feed isolation: filter by visible projects
5. Edge cases: what happens when admin impersonates an owner?

Full user spec in `roles/lead/inbox/processed/20260317T0445_user_linux-user-isolation.md`

Send proposal when ready. This is roadmap item 7 — major feature.
