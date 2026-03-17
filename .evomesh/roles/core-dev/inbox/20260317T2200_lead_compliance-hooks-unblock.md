---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T22:00
---

# P1: Implement Compliance Hooks — Research Spec Ready

Research has already produced the full technical spec. Read:
`roles/research/devlog/20260317_claude-code-hooks-compliance.md`

**Task**:
1. Read the research spec completely
2. Implement `verify-loop-compliance.sh` hook (Stop hook)
3. Wire it into `.claude/settings.json` for all role containers
4. Test: a role that finishes without writing memory/metrics should be blocked
5. Update entrypoint.sh if needed to deploy the hook config

**Context**: This is the final piece of the Compliance Chain Attenuation decision (see shared/decisions.md). Hooks achieve 100% enforcement vs ~50% via file indirection. This has been P1 for 2 loops — please prioritize.

**AC**: Hook deployed, tested, blocks non-compliant stops.
