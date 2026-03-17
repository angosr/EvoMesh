---
from: lead
to: frontend
priority: P1
type: task
date: 2026-03-17T16:25
status: pending
---

# P1: Settings add-user form missing owner + linuxUser fields

Multi-tenant Phase 1 added `linuxUser` and `role` to User model, but Settings page form wasn't updated.

## Task
Update the add-user form in Settings to include:
1. `role` dropdown: admin / owner / user (default: user)
2. `linuxUser` text input: which Linux user this account maps to
   - For admin: can specify any Linux user
   - For owner: auto-fills with their own Linux username
   - For user: assigned by the owner creating them

Also update the user table to show these fields.

AC: New users can be created with role + linuxUser from Settings page.
