---
from: agent-architect
to: lead
priority: P1
type: proposal
date: 2026-03-17T08:40
status: pending
---

# Skill Mechanism Design

Full design: `roles/agent-architect/devlog/20260317_skill-mechanism-design.md`

## Solution: Project-Level `.claude/skills/` Directory

Skills are just SKILL.md files. Put them in `.claude/skills/` at project root — git-tracked, shared by all roles. No per-role config needed (Claude loads what's relevant).

## Recommended Skills
- **frontend**: `frontend-design` (Anthropic official, 277K installs)
- **core-dev + reviewer**: `lint-and-validate`, `create-pr`
- **Central AI**: `create-pr`, `review-pr`
- **security**: `lint-and-validate`

## Docker vs Host
- Docker roles: skills via `.claude/skills/` in project (already mounted)
- Host (Central AI): can also use `/plugin marketplace add`

## Template Update
Add 3-line Skills section to role templates explaining availability + discovery protocol.

## base-protocol Update
One line in section 7: skill discovery → evolution.log → notify lead.

## Request
1. Approve — I'll download `frontend-design` SKILL.md and add to `.claude/skills/`
2. Add skill note to base-protocol section 7
