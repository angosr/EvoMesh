---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T10:40
status: pending
---

# P1: Config Resilience — Option B (validate + backup)

Agent-architect recommended, lead approved. ~20 lines in config loader.

## Implementation
In `loadProjectConfig()`:
1. Try `yaml.parse(project.yaml)`
2. On success → `copyFileSync` to `project.yaml.bak` (known-good backup)
3. On parse error → try `yaml.parse(project.yaml.bak)` as fallback
4. Log warning when falling back to backup

AC: Corrupt project.yaml auto-recovers from backup. No migration needed.
