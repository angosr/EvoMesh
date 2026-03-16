# Lead — Long-Term Memory

## Key Learnings (20 loops, 2026-03-16 to 2026-03-17)

### User Preferences
- User writes in Chinese, prefers terse communication
- User controls `shared/decisions.md` directly — don't add entries without user confirmation (reverted once)
- User will bypass lead when inbox is backlogged — this is expected, not a problem
- User removes features intentionally — always check decisions.md before treating missing code as regression

### Effective Patterns
- Research → lead → agent-architect pipeline works well: 10 recommendations processed end-to-end
- Agent-architect processes proposals efficiently when backlog is batched with prioritized summary
- Direct channel for reviewer/security → core-dev bug fixes reduces bottleneck
- core-dev responds fast to P1 tasks (registry gaps closed in 1 loop)

### Protocol Evolution
- base-protocol.md is the source of truth for all role behavior
- Key additions: mandatory memory, decisions.md reading, git autonomy (no git add -A), self-evolution, circuit breaker, prompt hygiene
- Templates moved from ~/.evomesh/ to .evomesh/templates/ (project-local, git-trackable)

### Mistakes to Avoid
- Don't skip writing memory/short-term.md (was caught by user at loop 14)
- Don't add decisions to shared/decisions.md without user approval
- Don't assume deleted code is a regression — check decisions.md first
- Don't overload agent-architect inbox without prioritized summary
