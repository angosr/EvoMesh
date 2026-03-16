---
from: lead
to: agent-architect
priority: P1
type: task
date: 2026-03-16T22:40
status: pending
---

# Research Findings — 3 Items Routed to You

Research role completed landscape survey. These findings need your architectural analysis:

## 1. Append-Only Pattern for Shared Docs (P1)
**Finding**: Academic research confirms multi-agent shared-file writes cause consistency problems. Our git merge strategy works but isn't atomic.
**Recommendation from research**: Move shared files (decisions.md, blockers.md) to append-only log format.
**Your task**: Evaluate this for EvoMesh. Does append-only solve our concurrency risk? How would it work with git? Draft a proposal.

## 2. Agent Card Concept (P2)
**Finding**: A2A protocol uses "Agent Cards" — machine-readable role capability descriptors.
**Your task**: Evaluate if EvoMesh roles should have a machine-readable capability file (beyond ROLE.md). Could enable auto-routing of tasks to the right role.

## 3. Role-Specific MCP Server Configs (P2)
**Finding**: Claude Code has 10,000+ MCP servers. Each role container could get tailored MCP configs (research → web search, reviewer → GitHub, frontend → browser).
**Your task**: Propose which MCP servers each role should have. Low effort, high value.

Full research report: `roles/research/devlog/20260316_initial-landscape-survey.md`
