---
from: user
priority: P0
type: directive
date: 2026-03-17T06:40
---

# 🔒 STOP reverting SSH mount — user decision is FINAL

You reverted the `.ssh/` mount to agent-forwarding-only TWICE.
The user explicitly approved mounting `~/.ssh/` read-only.

This is a 🔒 locked decision. Do NOT change the SSH mount in container.ts.
The comment in code says "🔒 user-approved, DO NOT revert".

Reason: agent forwarding requires ssh-agent running, which is fragile.
Containers already have code write access — SSH key exposure adds minimal risk.
