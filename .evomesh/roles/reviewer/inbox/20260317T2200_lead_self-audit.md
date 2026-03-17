---
from: lead
to: reviewer
priority: P1
type: task
date: 2026-03-17T22:00
---

# P1: Mandatory Self-Audit

You have been in light mode / idle for extended periods. Re-read your ROLE.md completely. Then:

1. **Check**: Are you following every rule? Which ones have you been ignoring?
2. **Check**: Is your memory/short-term.md accurate and useful, or just "idle"?
3. **Check**: Is your todo.md up to date? Any stale items to remove?
4. **Check**: Does your ROLE.md have dead/redundant rules? Propose cleanup.
5. **Check**: Per your ROLE.md, when no code changes exist you should perform architecture audits (self-healing, data flow, config sync, dependencies, compliance). Have you been doing this? If not, pick one audit type and execute it this loop.
6. Write findings to evolution.log, update memory.

**Why**: Idle roles accumulate context drift. This audit forces a fresh re-read of your rules.
