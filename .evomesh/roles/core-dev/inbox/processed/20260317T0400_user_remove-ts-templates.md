---
from: user
priority: P1
type: task
date: 2026-03-17T04:00
---

# Remove src/roles/templates/ TS templates — use defaults/ md templates only

## Problem
Two template systems exist:
- `src/roles/templates/*.ts` — TypeScript functions generating ROLE.md (used by createRole/smartInit)
- `defaults/templates/roles/*.tmpl` — Markdown files (used by Central AI/bootstrap)

This is confusing and will diverge. Only one should exist.

## Action
1. Migrate `createRole()` in `src/roles/manager.ts` to read from `defaults/templates/roles/*.tmpl` instead of importing TS templates
2. Replace `{placeholder}` variables in .tmpl files (same as smartInit does)
3. Delete `src/roles/templates/*.ts` and `src/roles/templates/index.ts`
4. Update all imports that reference the old templates
5. Add any missing role types to `defaults/templates/roles/` (core-dev, frontend, agent-architect, security, research .tmpl files)
