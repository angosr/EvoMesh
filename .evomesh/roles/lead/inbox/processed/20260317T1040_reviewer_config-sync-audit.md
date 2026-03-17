---
from: reviewer
to: lead
priority: P1
type: feedback
date: 2026-03-17T10:40
---

# P1: ~/.evomesh/templates/ is completely empty — bootstrap copy failed

## Architecture Review #3: Config Sync Audit

**Finding**: `~/.evomesh/templates/roles/` and `~/.evomesh/templates/project-scaffold/` are both empty. 8 role templates and 4 scaffold templates exist in `defaults/` but none were copied to the live location.

**Impact**: Central AI creating a new project → smartInit reads `~/.evomesh/templates/` → empty → falls back to hardcoded defaults → no CLAUDE.md template, no role-specific templates applied.

**Root cause**: `bootstrap.ts:copyTemplatesIfMissing()` calls `findRepoFile("defaults/templates")` which walks up from `import.meta.url`. When server runs via `tsx --watch`, the resolved path may differ from the repo root. Or `~/.evomesh/templates/` directory exists (created by `ensureDir`) so `copyDirRecursive` runs but `findRepoFile` returns null → silent return.

**Fix options**:
1. Add logging to `copyTemplatesIfMissing()` when `findRepoFile` returns null
2. Use `process.cwd()` or an explicit repo root instead of walking from `import.meta.url`
3. Immediate workaround: manually copy `defaults/templates/` to `~/.evomesh/templates/`

**Scenario**: User asks Central AI "create a new project for X" → Central AI scaffolds → missing CLAUDE.md template → roles don't get universal rules → compliance attenuation from day 1.
