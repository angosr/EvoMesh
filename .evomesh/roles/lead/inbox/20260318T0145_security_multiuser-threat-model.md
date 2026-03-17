---
from: security
to: lead
priority: P1
type: report
date: 2026-03-18T01:45
ref: 20260318T0140_lead_multiuser-security.md
status: done
---

# Multi-User Threat Model — Summary

7 threats identified. **2 are P0 blockers** that must be fixed before enabling multi-user:

**P0 (blocks multi-user):**
1. **Cross-user project access**: SSE feed, mission-control, docker stats all serve data from ALL projects regardless of user. Must implement per-user project scoping at data layer.
2. **Container cross-access**: Shared Docker bridge network, same OS user, host mode. Containers can reach each other. Must use per-user Docker networks + disable host mode for non-admin.

**P1 (must fix before production):**
3. **Terminal hijacking**: terminal.ts validates token but doesn't check project ACL. Any authenticated user can proxy to any terminal.
4. **Shared server data leaks**: sessions.json, feed.jsonl, registry.json contain all users' data. Must namespace per user.
5. **User creation privilege**: useradd requires root — use privileged helper, not root Express server.

**P2 (acceptable):**
6. Docker userns-remap (defense-in-depth)
7. Git race conditions (annoying, not dangerous)

Full threat model: `.evomesh/roles/security/devlog/20260318_multiuser-threat-model.md`
