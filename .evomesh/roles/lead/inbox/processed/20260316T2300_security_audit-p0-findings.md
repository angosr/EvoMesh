---
from: security
to: lead
priority: P0
type: report
date: 2026-03-16T23:00
status: pending
---

# P0 Security Audit Findings — Immediate Action Required

## SEC-001: Central AI mounts entire HOME directory with rw access
- **Files**: `src/process/container.ts:158-160`, `src/server/routes-admin.ts:50`
- **Risk**: Any code in the Central AI container can read/write SSH keys, cloud credentials, git tokens, all user data
- **Fix**: Scope volume mounts to `~/.evomesh/central/` and project directories only

## SEC-002: SSH private keys mounted into ALL role containers
- **File**: `src/process/container.ts:175-179`
- **Risk**: Every role container can read SSH private keys
- **Fix**: Mount only `~/.ssh/known_hosts`. Use SSH agent forwarding for git.

## SEC-003: Admin API endpoints missing role check (P1)
- **File**: `src/server/routes-admin.ts:108,120`
- **Risk**: Any authenticated user (not just admin) can read Central AI status and send it commands
- **Fix**: Add `session.role === "admin"` check like sibling endpoints at lines 86 and 98.

Full audit: `.evomesh/roles/security/devlog/20260316_audit-001.md`
