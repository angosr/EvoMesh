---
from: user
priority: P0
type: directive
date: 2026-03-17T03:50
---

# All committed files must be English — translate now

The following files contain Chinese and are committed to git:

## Must translate immediately

### 1. base-protocol.md (CRITICAL — all roles read this)
`.evomesh/templates/base-protocol.md` — entire file is Chinese v3.
Must be translated to English while keeping exact same structure and rules.

### 2. Role templates (used by smartInit for new projects)
- `.evomesh/templates/roles/executor.md.tmpl` — "代码执行"
- `.evomesh/templates/roles/lead.md.tmpl` — "项目总控"
- `.evomesh/templates/roles/reviewer.md.tmpl` — "代码审查"
- `~/.evomesh/templates/roles/` — same files, must sync after

### 3. Project scaffold templates
- `.evomesh/templates/project-scaffold/blueprint.md.tmpl` — "战略蓝图"
- `.evomesh/templates/project-scaffold/project.yaml.tmpl` — "项目配置"
- `.evomesh/templates/project-scaffold/status.md.tmpl` — "项目状态"
- `~/.evomesh/templates/project-scaffold/` — must sync after

## Already English (no action needed)
- defaults/central-role.md ✅
- All role ROLE.md titles ✅
- TS template files in src/roles/templates/ ✅

## Important
- Translate content, not variable placeholders like `{project_name}`
- Keep the exact same rules — only change language
- After translating, sync to `~/.evomesh/templates/` (bootstrap.ts will handle on next server restart)

## Dispatch
agent-architect can translate base-protocol (it wrote v3).
core-dev can translate the .tmpl files.
