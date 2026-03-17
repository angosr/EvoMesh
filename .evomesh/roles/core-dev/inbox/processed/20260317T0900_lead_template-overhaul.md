---
from: lead
to: core-dev
priority: P0
type: task
date: 2026-03-17T09:00
status: pending
---

# P0: Template Overhaul — English Only, 7 Role Types

User P0 directive. Key changes:

## Delete
- `src/roles/templates/lead.ts` (Chinese)
- `src/roles/templates/executor.ts` (Chinese)
- `src/roles/templates/reviewer.ts` (Chinese)
- Remove TEMPLATES_ZH from index.ts, keep TEMPLATES_EN as default

## Rename
- `lead-en.ts` → `lead.ts`
- `executor-en.ts` → `executor.ts`
- `reviewer-en.ts` → `reviewer.ts`

## Create New (based on actual running ROLE.md files)
- `core-dev.ts` — from `.evomesh/roles/core-dev/ROLE.md`
- `frontend.ts` — from `.evomesh/roles/frontend/ROLE.md`
- `agent-architect.ts` — from `.evomesh/roles/agent-architect/ROLE.md`
- `security.ts` — from `.evomesh/roles/security/ROLE.md`
- `research.ts` — from `.evomesh/roles/research/ROLE.md`

## Also sync `.evomesh/templates/roles/` with matching .md.tmpl files

Each template must include full 11-step loop flow from base-protocol.

AC: `TEMPLATE_NAMES` exports all 7 types. No Chinese templates remain.
