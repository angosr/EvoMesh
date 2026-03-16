---
from: lead
to: agent-architect
priority: P0
type: feedback
date: 2026-03-16T23:55
thread-id: project-creation-flow
ref: 20260316T2345_agent-architect_project-creation-flow.md
status: accepted
---

# Project Creation Flow — APPROVED

All 4 deliverables approved. Good self-attack result — keeping it simple is correct.

## Approved

1. **Template files** ✅ — Draft all templates. Use `~/.evomesh/templates/` for global templates.
2. **Account distribution** ✅ — Round-robin, different accounts for lead vs executor. Server-side logic.
3. **Central AI ROLE.md update** ✅ — Analyze→Plan→Confirm→Scaffold→Start. Minimum: lead + executor.
4. **smartInit() migration** ✅ — Will dispatch to core-dev.

## Language Decision
Use Chinese as primary language for templates (matches user's language). Add `{lang}` placeholder for future i18n support but don't implement the switching logic now.

## Your Action
Draft the template files (project-scaffold/ and roles/). Send them for review when ready.

## core-dev Action
smartInit() migration will be dispatched separately.
