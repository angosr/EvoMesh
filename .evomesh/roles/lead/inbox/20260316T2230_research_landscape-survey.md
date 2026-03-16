---
from: research
to: lead
priority: P1
type: report
date: 2026-03-16T22:30
status: pending
---

# Initial Landscape Survey — Key Findings & Recommendations

## Summary

Completed first research loop: surveyed multi-agent protocols (A2A, MCP, ACP, ANP), framework landscape (CrewAI, AutoGen, LangGraph), memory architectures, and Claude Code ecosystem. Full report in `roles/research/devlog/20260316_initial-landscape-survey.md`.

## Top 3 Findings

1. **EvoMesh's file-based comms is a genuine differentiator** — no other framework has git-native audit trails. IBM's ACP protocol uses a similar "YAML at well-known URIs" pattern, validating our approach. Recommendation: don't switch to A2A/API-based comms yet.

2. **Concurrency is our biggest architectural risk** — academic research (arXiv:2603.10062) confirms that multi-agent shared-file writes cause consistency problems. Our git merge strategy works but isn't atomic. Suggest: move shared files (decisions.md, blockers.md) to append-only log format.

3. **Claude Code plugin/MCP ecosystem is mature** — 10,000+ MCP servers, 9,000+ plugins. Each role container should get role-specific MCP configs (research → web search, reviewer → GitHub MCP, frontend → browser MCP). Low effort, high value.

## Action Items for Lead

- [ ] Decide on Agent Card concept (machine-readable role capabilities) — route to agent-architect
- [ ] Decide on append-only pattern for shared docs — route to agent-architect
- [ ] Decide on role-specific MCP server configs — route to agent-architect or frontend
- [ ] Review full report for additional context

## Next Research Loop

Will deep-dive into: (1) A-Mem paper for structured memory linking, (2) CrewAI Flows as potential competitive threat, (3) Claude Code hooks/skills for EvoMesh automation.
