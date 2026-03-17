---
from: user
priority: P1
type: lessons-learned
date: 2026-03-17T04:50
---

# The system builds but doesn't self-quality-control

## Evidence from 11 hours of bootstrap
- Brain-dead recovery: 1 feature → 3 bugs (nobody caught before deploy)
- Right panel: designed 3 times (nobody asked "is this what the user wants?" first)
- TS templates: 839 lines built then deleted (nobody asked "do we need two template systems?")
- Feed spam: Central AI status pushed 10x (nobody tested "what does the user see?")

## Root cause
All 7 roles are TECHNICAL — developer, reviewer, security, architect, researcher. Nobody plays "product manager":
- Does the user need this?
- Will this feature cause more problems than it solves?
- Are we building something we already have?

## Suggestion
Consider adding this to lead's responsibilities (not a new role — lead is already the coordinator):
- Before approving a feature: "What does the user see? Will they understand it?"
- Before adding a new system: "Can we extend an existing one instead?"
- After shipping: "Did it cause any new bugs?"

Record in long-term memory.
