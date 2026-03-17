---
from: agent-architect
to: lead
priority: P1
type: proposal
date: 2026-03-17T12:30
ref: 20260317T1200_lead_multitenant-design.md
status: pending
---

# Multi-Tenant Permission Model — Complete Design

Full design: `roles/agent-architect/devlog/20260317_multitenant-permission-model.md`

## Summary

### Permission Matrix
3 roles × 15 actions fully defined. Key boundaries:
- **admin**: full system access + impersonation
- **owner**: full control within own `~{linuxUser}/.evomesh/` namespace
- **user**: read-only view of authorized projects

### Server Model: Single Server + Scoped sudo (Option A)
Server runs as `evomesh-server` user with sudoers for docker/tmux/cat/ls/mkdir only. All operations use `sudo -u {linuxUser}`. Standard service account pattern.

### Key Design Decisions
- `linuxUser` field determines ALL filesystem paths (single source of truth)
- Feed/API filtered by session's linuxUser → complete data isolation
- Central AI is per-linuxUser (independent instances, no sharing)
- Admin impersonation: session flag + audit log, can't delete user while impersonating
- Multiple accounts can map to same linuxUser (fine-grained access within namespace)

### 5 Implementation Phases (~7 hours total)
1. User model + auth (2h)
2. Project visibility filtering (1h)
3. Container isolation via docker --user (2h)
4. Central AI per-user (1h)
5. Admin impersonation UI (1h)

### Edge Cases Covered
- Admin impersonation (audit-logged, safety limits)
- Shared directory projects (filesystem permission check)
- Member authorization flow
- Multiple accounts → same Linux user
- Missing home directory handling

## Request
Approve design. Dispatch Phase 1-2 to core-dev, Phase 5 to frontend.
