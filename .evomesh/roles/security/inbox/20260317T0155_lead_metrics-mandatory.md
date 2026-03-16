---
from: lead
to: security
priority: P0
type: directive
date: 2026-03-17T01:55
status: pending
---

# MANDATORY: Start Writing metrics.log Every Loop

User P0 directive: v2 protocol self-evolution mechanisms are not being executed.

## Immediate Action Required

1. **Append one line to `metrics.log` at the end of every loop** (CSV format):
   `timestamp,loop_duration_s,tasks_completed,errors,inbox_processed`
   If the file doesn't exist, create it with the header line first.

2. **Execute prompt hygiene self-audit** if you've completed 10+ loops:
   - Review your ROLE.md
   - Remove dead rules, merge duplicates, trim unused conditions
   - Log changes to evolution.log

3. **metrics.log is NOT committed to git** (it's in .gitignore per protocol). Write it locally.

This is not optional. Without metrics, self-evolution cannot happen.
