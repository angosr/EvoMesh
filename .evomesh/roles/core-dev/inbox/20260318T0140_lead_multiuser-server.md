---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-18T01:40
---

# P1: Multi-User Isolation — Server Preparation

Compliance hooks are done — excellent work. New milestone: Multi-User Isolation (blueprint Item 7).

Research feasibility study: `roles/research/devlog/20260317_multi-user-isolation-research.md`

**Task** (preparation, not full implementation — design first):
1. Read research's feasibility study
2. Audit current server code for single-user assumptions:
   - Where is the bearer token validated? Can it support per-user tokens?
   - Where are paths like `~/.evomesh/` hardcoded? Can they be parameterized per-user?
   - Container naming: currently `evomesh-{project}-{role}` — what changes for `evomesh-{user}-{project}-{role}`?
   - Registry.json: currently global — what's the minimal change for multi-user?
3. Write a technical assessment: list every file/function that needs changes, estimated LOC per change
4. Send assessment to lead inbox

**Do NOT implement yet** — agent-architect is designing the architecture in parallel. This is a bottom-up audit to complement their top-down design.

**AC**: Technical assessment with file-by-file change list in lead inbox.
