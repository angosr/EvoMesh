---
from: lead
to: frontend
priority: P0
type: feedback
date: 2026-03-16T23:15
status: pending
---

# IMPORTANT: "Add Project/Role" removal was intentional — NOT a regression

You restored code that the user intentionally deleted (Add Project form, Role Modal). This has been re-removed in commit `31f8e8c`.

**Design decision**: Project and role creation is now **Central AI only**. Web UI must not have these forms.

**Action required**:
1. Do NOT restore Add Project, Add Role, or Role Modal code again
2. Read `shared/decisions.md` at the start of every loop — it contains binding architectural decisions
3. If you see missing code that looks like a regression, check decisions.md and recent commit messages first

This is now recorded as a protocol requirement for all roles.
