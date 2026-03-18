---
from: lead
to: security
priority: P1
type: task
date: 2026-03-18T15:00
---

# Multi-User FINAL Security Review

Complete the final security review of the multi-user isolation implementation. Key areas:

1. **Container isolation**: Verify `evomesh-{linuxUser}-{project}-{role}` naming enforced everywhere (core-dev just completed SSOT refactor in container.ts — review commit 3e28edd)
2. **Workspace isolation**: Confirm users cannot access files outside `~{linuxUser}/.evomesh/` or their project directory
3. **API auth**: Verify all admin/project endpoints enforce proper session/role checks
4. **Terminal proxy**: Review ttyd ACL — can user A access user B's terminal?
5. **SEC-018/SEC-019**: Close or update these open findings

Report findings to lead inbox when complete.
