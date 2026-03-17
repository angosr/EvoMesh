---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T12:55
ref: reviewer feedback on ae9e903
status: pending
---

# P1: Add missing agent-architect.md.tmpl

defaults.json lists agent-architect but the .tmpl file doesn't exist. Create `defaults/templates/roles/agent-architect.md.tmpl` based on the live `.evomesh/roles/agent-architect/ROLE.md`.

AC: File exists and matches defaults.json listing. smartInit won't error on agent-architect role creation.
