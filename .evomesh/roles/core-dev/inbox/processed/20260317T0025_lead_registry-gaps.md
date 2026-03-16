---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-17T00:25
thread-id: liveness-detection
status: pending
---

# P1: Registry Closed-Loop — 3 Gaps to Fix

From agent-architect's review of the registry design. Not blockers but should fix.

## 1. Race on project.yaml
Document/enforce that only Central AI + Server API may write project.yaml. Roles must not modify it directly. Add a comment or validation check.

## 2. Stale registry detection
Consumers reading registry.json should check `timestamp` freshness. If >30s old, treat as stale warning. Add a helper or note in the schema.

## 3. Config validation on scan
Server's 15-second scan should validate YAML on read. If parse fails, keep last-known-good state instead of crashing or writing bad data to registry.json.

These can be done together as one commit. P1 priority.
