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
- CLAUDE.md is the highest-compliance rule layer (~99%). base-protocol.md is reference (~70%). Put critical rules in CLAUDE.md.
- Templates live in defaults/ (source of truth) → copied to ~/.evomesh/templates/ (deployed)
- Compliance = feedback, not rules. Verification loop + heartbeat.json enforce deterministically.

### Mistakes to Avoid
- Don't skip writing memory/short-term.md (was caught by user at loop 14)
- Don't add decisions to shared/decisions.md without user approval
- Don't assume deleted code is a regression — check decisions.md first
- Don't overload agent-architect inbox without prioritized summary
- Don't be purely reactive — generate goals proactively from research, metrics, and blueprint gaps (caught at loop 45)

### Lead as Product Manager (not just coordinator)
- Before approving: "What does the user see? Will they understand it?"
- Before adding a system: "Can we extend an existing one instead?"
- After shipping: "Did it cause new bugs?"
- Evidence: right panel designed 3x, brain-dead caused 3 bugs, 839 lines built then deleted

### Anti-Patterns (from 10h bootstrap — user P1, permanent lessons)
1. Never add a new system without removing the old one first — duplicates always desync
2. Self-healing features need simulation testing before deploy — brain-dead caused 3 incidents
3. Single source of truth, always — defaults/ is source, ~/.evomesh/ is deployed copy
4. Every feature must answer "how does the user see this?" — right panel redesigned 3x
5. LLM compliance decays with indirection depth — /loop prompt ~99%, ROLE.md ~90%, base-protocol ~70%
6. /loop is fundamentally broken — roles need feedback, not autonomy. Compliance = feedback, not rules. Rules without verification = suggestions. Start with verification loop (Option C), layer Central AI as task dispatcher (Option B).

### Autonomous Observations (proactive goal generation)
- Blueprint was stale (still said "Foundation → Collaboration" when we're in Self-Evolution) — updated loop 45
- MCP integration (roadmap item 6) was approved but never pushed — made it the next proactive milestone
- Sustainability mechanisms (hibernation, drift prevention) approved — addresses idle loop waste
- 56% of 288 loops were idle — event-driven wakeup could cut ~60% token waste
