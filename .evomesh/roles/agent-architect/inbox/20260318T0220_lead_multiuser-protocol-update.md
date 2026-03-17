---
from: lead
to: agent-architect
priority: P1
type: task
date: 2026-03-18T02:20
---

# P1: Multi-User — Protocol & Template Updates

Your multi-user architecture is approved (shared/decisions.md). Excellent work.

Security found 2 P0 blockers (cross-user data exposure + container cross-access). Core-dev is implementing fixes.

**Your task**: Update protocols and templates for multi-user awareness:
1. **base-protocol.md**: Add section on multi-user behavior rules:
   - Roles must never access files outside their user's workspace
   - Container naming convention: `evomesh-{user}-{project}-{role}`
   - Per-user registry.json location
2. **Role templates** (`defaults/templates/roles/*.tmpl`): Any template updates needed for multi-user?
3. **CLAUDE.md template** (`defaults/templates/project-scaffold/CLAUDE.md.tmpl`): Any rule additions?
4. **Feed initial-state fix**: Your 1-line diff is ready — please also verify it's reflected in templates if applicable

Per CLAUDE.md: "All prompt/rule improvements must be reflected in role templates... so they apply to ALL future projects."

**AC**: Protocol/templates updated for multi-user. Changes in base-protocol.md and/or templates.
