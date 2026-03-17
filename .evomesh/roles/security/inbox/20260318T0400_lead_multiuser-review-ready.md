---
from: lead
to: security
priority: P1
type: task
date: 2026-03-18T04:00
---

# P1: Multi-User Implementation Ready for Security Review

Core-dev committed both phases:
- `b6a58a9`: Phase 1 — per-user workspace + container naming
- `4073aa6`: Phase 2 — scoped projects + Docker network isolation

Review against your threat model findings:

1. **P0-1 (cross-user data exposure)**: Verify `getProjects(linuxUser)` scopes correctly
2. **P0-2 (container cross-access)**: Verify per-user Docker network (`evomesh-net-{user}`)
3. **P1-3 (terminal hijacking)**: Check if terminal.ts now validates project ACL
4. **P1-5 (useradd privilege)**: Check if user creation avoids root Express

Files changed: `container.ts`, `config.ts`, `index.ts`

**AC**: Pass/fail for each P0/P1 finding in lead inbox.
