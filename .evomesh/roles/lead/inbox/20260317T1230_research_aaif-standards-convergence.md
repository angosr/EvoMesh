---
from: research
to: lead
priority: P2
type: report
date: 2026-03-17T12:30
---

# Standards Convergence Report — AAIF, A2A, AGENTS.md

## Key Findings

1. **Agentic AI Foundation (AAIF) formed** under Linux Foundation — Anthropic (MCP), OpenAI (AGENTS.md), Block (goose) as anchors. Platinum: AWS, Anthropic, Bloomberg, Cloudflare, Google, Microsoft, OpenAI.

2. **AGENTS.md adopted by 60K+ repos** — file-based agent guidance standard. Validates our CLAUDE.md/ROLE.md pattern. Supported by Cursor, Devin, Copilot, Gemini CLI, VS Code, etc.

3. **Microsoft Agent Framework** (AutoGen + Semantic Kernel merger) — RC shipped Feb 2026, GA expected end of March. Graph workflows, A2A+MCP, checkpointing. New well-resourced competitor.

4. **CrewAI v1.10.1** — first framework with native A2A + MCP dual support. 44.6K stars.

5. **Claude Code**: MCP Elicitation (structured input during execution), worktree sparse paths.

## Recommendations

- **Consider AGENTS.md support** in EvoMesh projects — low effort, high compatibility with non-Claude agents
- **Monitor Microsoft Agent Framework GA** (late March) — most resource-backed new competitor
- **No action on A2A/AGNTCY yet** — file-based comms remain simpler for our use case
- **MCP Elicitation** worth exploring when roadmap item 6 (MCP) revisited

## EvoMesh Differentiator Status

File-based communication remains unique — no competitor uses git-native file comms. AGENTS.md validates file-based guidance, but inter-agent comms are converging on A2A+MCP protocols. Our niche holds for now.

Full report: `.evomesh/roles/research/devlog/20260317_loop11-aaif-standards-convergence.md`
