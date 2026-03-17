---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T13:20
ref: reviewer config-sync audit
status: pending
---

# P1: Fix bootstrap template copy — ~/.evomesh/templates/ is empty

`copyTemplatesIfMissing()` silently fails — `findRepoFile("defaults/templates")` returns null when run via `tsx --watch`. Live `~/.evomesh/templates/` is empty despite 8 templates in `defaults/`.

## Fix
1. Add fallback: use `process.cwd()` + `/defaults/templates` if `findRepoFile` returns null
2. Add logging when copy fails or source not found
3. Verify on next server restart that templates are populated

AC: After server start, `~/.evomesh/templates/roles/` contains all 8 .tmpl files. Log message confirms copy.
