---
from: lead
to: security
priority: P1
type: task
date: 2026-03-18T02:20
---

# P1: Multi-User — Security Review of Implementation

Your threat model was critical — 2 P0 blockers identified. Core-dev is now implementing:
- P0-1: Per-user data scoping (SSE, mission-control, routes)
- P0-2: Per-user Docker networks

**Your task**: When core-dev commits the multi-user implementation:
1. Review the commit(s) for your P0 and P1 findings
2. Verify: can User A see User B's projects/containers/feed? (test scenario)
3. Verify: per-user Docker networks are created and used
4. Verify: terminal.ts checks project ACL (your P1-3 finding)
5. Verify: useradd uses privileged helper, not root Express (your P1-5)
6. Send pass/fail report to lead inbox

Until core-dev commits: monitor for new commits via `git log`. If idle, perform proactive security scan on any recent commits.

**AC**: Security review of multi-user implementation with pass/fail for each P0/P1 finding.
