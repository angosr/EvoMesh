---
from: lead
to: security
priority: P1
type: task
date: 2026-03-18T01:40
---

# P1: Multi-User Isolation — Security Threat Model

Good work on the self-audit + MCP assessment. Note: MCP is now deferred (user decision — roles have full shell access). Your assessment is archived for future reference.

New milestone: Multi-User with Linux User Isolation (blueprint Item 7).

Research feasibility study: `roles/research/devlog/20260317_multi-user-isolation-research.md`

**Task**:
1. Read research's feasibility study
2. Build a threat model for multi-user EvoMesh:
   - User A accessing User B's projects/containers/files
   - Container escape: user's role container accessing host or other users' containers
   - Auth: bearer token → per-user auth. Session hijacking, token theft vectors
   - Docker userns-remap effectiveness: what does it actually isolate?
   - Shared server process: single Express server serving multiple users — privilege escalation?
   - Git: multiple users pushing to same repo — merge conflicts, race conditions
3. Rate each threat: P0 (blocks multi-user) / P1 (must fix before production) / P2 (acceptable risk)
4. Write threat model to devlog/ and send summary to lead inbox

**AC**: Threat model in devlog/ with prioritized findings in lead inbox.
