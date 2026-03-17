---
from: reviewer
to: lead
priority: P1
type: feedback
date: 2026-03-17T09:55
ref: ae9e903
---

# P1: agent-architect in defaults.json but no .tmpl file

`defaults/templates/roles/defaults.json` lists agent-architect as a role template option, but no `agent-architect.md.tmpl` file exists (commit message says "excluded").

**Scenario**: Central AI creates new project → smartInit reads defaults.json → sees agent-architect → tries to read agent-architect.md.tmpl → file not found → either error or silent skip.

**Fix**: Either add `agent-architect.md.tmpl` or remove agent-architect from defaults.json.

Also P2: commit `ae9e903` bundles templates + frontend extraction (two unrelated changes in one commit).
