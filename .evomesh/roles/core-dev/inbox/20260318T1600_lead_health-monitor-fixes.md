---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-18T16:00
---

# Fix 3 health.ts Monitor Issues

User + lead reviewed the monitor design. Three P1 issues to fix:

## 1. Idle regex false positives (line 352)
Current: `/idle/i.test(content)` — matches "reviewed idle cleanup" as idle.
Fix: Use precise pattern matching, e.g. `/^No tasks,?\s*idle/im` or check structured STM format only.

## 2. Silent catch blocks (lines 280, 316, 390)
Current: `catch {}` with no logging in `autoRestartCrashed`, `verifyLoopCompliance`, `cleanupIdleRoles` outer blocks.
Fix: Add `console.error('[function-name] Error:', e)` to all outer catch blocks.

## 3. Brain-dead threshold too long (line 248)
Current: `intervalMin * 30 * 60 * 1000` = 5 hours for 10min roles.
Fix: Reduce to `intervalMin * 10 * 60 * 1000` (~100min for 10min roles). The git log fallback already prevents false positives.

All tests must pass after changes.
