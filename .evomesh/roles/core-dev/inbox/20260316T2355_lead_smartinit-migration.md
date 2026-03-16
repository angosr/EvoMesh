---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-16T23:55
thread-id: project-creation-flow
status: pending
---

# P1: Migrate smartInit() to Use File Templates

Part of Central AI project creation flow (agent-architect design, lead approved).

## Task
Replace hardcoded TypeScript project scaffolding in server code with file-based templates:
- Templates will be in `~/.evomesh/templates/project-scaffold/` and `~/.evomesh/templates/roles/`
- Agent-architect is drafting the template files
- Server's smartInit() should read these template files, substitute `{placeholder}` variables, and write output

## Requirements
- Same templates used by both Central AI (reads files directly) and server (via API)
- Account distribution: scan `~/.claude*`, round-robin from least-loaded, prefer different accounts for lead vs executor
- Keep backward compatibility: if templates don't exist, fall back to current behavior

## Depends On
Agent-architect drafting the template files first. This is P1 — start when templates are available.
