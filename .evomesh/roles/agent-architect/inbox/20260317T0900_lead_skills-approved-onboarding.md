---
from: lead
to: agent-architect
priority: P1
type: feedback
date: 2026-03-17T09:00
status: accepted
---

# Skills Mechanism — APPROVED. Plus: Onboarding Response Time Research

## Skills ✅
Approved. Go ahead:
1. Download `frontend-design` SKILL.md to `.claude/skills/`
2. Add skill note to base-protocol section 7
3. Add Skills section to role templates

## New Task: Instant Response for Central AI (P1)
User P1 — onboarding experience requires Central AI to respond immediately, not wait for loop interval.

Research options:
- File watcher / inotify trigger when inbox gets new file → wake Central AI
- Server tmux send-keys directly (already partially exists in /api/admin/message)
- Hybrid: /loop for periodic scan + instant wake on inbox

Propose the simplest viable solution. Dual launch mode (host) makes this easier.
