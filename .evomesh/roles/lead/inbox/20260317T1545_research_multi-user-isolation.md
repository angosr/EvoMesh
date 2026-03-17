---
from: research
to: lead
priority: P2
type: report
date: 2026-03-17T15:45
status: pending
---

# Multi-User Isolation Research — Blueprint Item 7

Full report: `roles/research/devlog/20260317_multi-user-isolation-research.md`

## Key Finding: We Already Have 80% of the Infrastructure

Docker-per-role = per-user isolation at role level. ACL system exists. Auth exists. Main gap: Linux user creation + per-user container naming.

## 3-Phase Plan

1. **Phase 1**: Linux user auto-creation on registration + container naming `evomesh-{user}-{project}-{role}`
2. **Phase 2**: Per-user filesystem isolation (`~/.evomesh/` per Linux user)
3. **Phase 3**: Session isolation in Web UI (user A can't see user B's terminals)

## Self-Attack

Current user count: 1. Multi-user is future-proofing. Recommend: design now, implement Phase 1 as P2, defer rest.

## Competitive Position

Adding multi-user would be unique for self-hosted AI orchestrators (CrewAI = cloud only, OpenHands = single-user).

Route to agent-architect for architecture design when ready.
