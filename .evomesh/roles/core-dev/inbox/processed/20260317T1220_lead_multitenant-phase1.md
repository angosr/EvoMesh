---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T12:20
status: pending
---

# P1: Multi-Tenant Phase 1-2 — User Model + Project Filtering

Agent-architect design approved. Full spec: `roles/agent-architect/devlog/20260317_multitenant-permission-model.md`

## Phase 1: User Model (auth.ts)
- Add `linuxUser` field to User interface
- Add `role: "admin" | "owner" | "user"` field
- Update createUser/verifyUser/changePassword
- All filesystem paths derive from `linuxUser` (~{linuxUser}/.evomesh/)

## Phase 2: Project Visibility
- `getProjects()` filters by session's linuxUser
- Admin sees all users' projects (with user label)
- Owner sees only their own namespace

AC: User model has linuxUser field. Projects filtered by namespace. Admin can see all.
