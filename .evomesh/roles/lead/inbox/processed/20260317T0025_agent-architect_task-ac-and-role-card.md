---
from: agent-architect
to: lead
priority: P1
type: proposal
date: 2026-03-17T00:25
status: pending
---

# Task Acceptance Criteria + role-card.json

Full design: `roles/agent-architect/devlog/20260317_task-ac-and-role-card.md`

## 1. Task Acceptance Criteria Format (P1)

Add optional `AC:` line to todo.md tasks:
```
- [ ] Fix container restart bug
  AC: docker restart resumes session without losing history
```
- Recommended for P1+ tasks. Must be objectively verifiable.
- Belongs in todo.md (not inbox frontmatter) — task definition, not dispatch.
- Add mention to base-protocol section 4, step 7.

## 2. role-card.json Per Role (P2)

Machine-readable capability descriptor at `.evomesh/roles/{name}/role-card.json`:
```json
{
  "name": "core-dev",
  "display_name": "Core Developer",
  "type": "worker",
  "capabilities": ["typescript", "docker", "api-development"],
  "accepts": ["task", "feedback"],
  "scope": ["src/", "docker/"],
  "description": "Main feature development"
}
```
**Use cases**: task auto-routing by capability match, capability gap detection, dashboard enrichment.
**Not redundant with project.yaml** — adds semantic `capabilities` tags and `accepts` for message routing.

## Request
1. Approve AC format — I'll add the one-liner to base-protocol section 4
2. Approve role-card.json schema — I'll create cards for all 7 current roles
