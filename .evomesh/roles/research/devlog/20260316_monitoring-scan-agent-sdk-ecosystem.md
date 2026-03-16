# Research Report — 2026-03-16 (Loop 5 — P2 Monitoring)

## Topic: Ecosystem Monitoring — Anthropic Agent SDK, Framework Landscape, Claude Code March Updates

---

## New Findings

### 1. Anthropic Agent SDK — Major Development

- [Anthropic: Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk): Claude Code SDK renamed to Claude Agent SDK. Same agent loop, tools, and context management as Claude Code, packaged as a library.
- [Agent SDK Overview (API Docs)](https://platform.claude.com/docs/en/agent-sdk/overview): General-purpose agent harness with built-in file ops, shell, web search, MCP integration.
- [Agent SDK Python (PyPI v0.1.48)](https://github.com/anthropics/claude-agent-sdk-python): Python SDK. Also available as TypeScript (npm v0.2.71).
- [Effective Harnesses for Long-Running Agents (Anthropic Engineering)](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents): Best practices for agent loops — directly applicable to EvoMesh role design.
- [Multi-agent docs](https://platform.claude.com/docs/en/agent-sdk/overview): "Spawn multiple Claude Code agents working on different parts simultaneously, with a lead agent coordinating, assigning subtasks, merging results."

**Critical relevance to EvoMesh**:

The Agent SDK's multi-agent pattern (lead agent coordinates, sub-agents work in parallel) is exactly EvoMesh's architecture — but implemented as a library rather than file-based orchestration. Key differences:

| Dimension | Agent SDK Multi-Agent | EvoMesh |
|-----------|----------------------|---------|
| Coordination | Lead agent in code | Lead role via files |
| Sub-agent spawn | Programmatic (SDK call) | Docker containers |
| Communication | In-memory tool calls | File-based inbox |
| Persistence | Ephemeral (per-session) | Git-native (permanent) |
| Audit trail | Tracing (optional) | Git history (automatic) |
| Human access | API/UI required | Read any file |

**Self-critique**: Should EvoMesh use the Agent SDK instead of Docker-per-role? **No, for now.** The Agent SDK is optimized for single-session task completion. EvoMesh is designed for continuous, long-horizon multi-role collaboration that persists across sessions. However, the Agent SDK could be used *within* EvoMesh — each role's Docker container could use the Agent SDK for complex intra-role subtasks (e.g., research role spawning sub-agents for parallel searches).

### 2. Claude Code March 2026 Updates

- [Claude Code Changelog](https://code.claude.com/docs/en/changelog): Major March updates.
- [March 2026 Updates Summary](https://pasqualepillitteri.it/en/news/381/claude-code-march-2026-updates): Voice mode, /loop, 1M context, Opus 4.6 default.

**Updates relevant to EvoMesh**:
1. **/loop command**: We're literally using this right now. EvoMesh roles can use /loop for autonomous operation within Claude Code sessions.
2. **1M context window (Opus 4.6)**: Reduces context pressure for roles that process many files per loop. Our COMPRESSION.md research findings are less urgent now.
3. **Memory timestamps**: Claude Code now adds last-modified timestamps to memory files. This aligns with our A-Mem research — freshness metadata helps prioritize relevant memories.
4. **Plugin MCP deduplication**: Prevents duplicate tool connections. Important when EvoMesh roles share MCP servers.

### 3. Framework Landscape Update (March 2026)

- [Top 9 AI Agent Frameworks (Shakudo)](https://www.shakudo.io/blog/top-9-ai-agent-frameworks): Current rankings as of March 2026.
- [Multi-Agent News Week of March 3](https://aiagentstore.ai/ai-agent-news/topic/multi-agent-systems/2026-03-03/detailed): Weekly roundup.
- [Mule AI: Rise of Multi-Agent Systems](https://muleai.io/blog/2026-03-13-multi-agent-ai-systems-rise/): March 13, 2026 analysis.

**Notable developments**:
- **xAI Grok-4.20 Multi-Agent Beta**: xAI entering multi-agent space. Not yet a competitive threat to Claude-based systems.
- **Market size**: $7.8B agentic AI tooling market in 2025. Agent framework repos with 1000+ stars went from 14 to 89 in one year.
- **Framework consolidation**: The market is consolidating around CrewAI (enterprise), LangGraph (complex workflows), and Anthropic Agent SDK (tool-use first). AutoGen losing mindshare to LangGraph.

**No new file-based communication frameworks have emerged.** EvoMesh remains unique in this approach.

---

## Analysis

### Agent SDK Opportunity

The Claude Agent SDK represents both a validation and an opportunity for EvoMesh:

**Validation**: Anthropic's own multi-agent architecture (lead + sub-agents) mirrors EvoMesh's design. We independently arrived at the same topology.

**Opportunity**: EvoMesh could use the Agent SDK as the execution engine inside each role's container. Instead of running raw Claude Code, roles could use the Agent SDK for:
- Parallel sub-task execution within a single role loop
- Structured tool access with built-in guardrails
- Native tracing for the metrics.log we recommended

**Risk**: If Anthropic adds file-based persistence to the Agent SDK, it becomes a direct competitor. Currently it's ephemeral — no persistence between sessions. Monitor closely.

### EvoMesh Positioning Updated

With 4 loops of research complete, EvoMesh's positioning is clear:

**What EvoMesh does that nothing else does**:
1. Git-native persistence — every agent action is version-controlled
2. Human-readable state — anyone can inspect the system by reading markdown files
3. Offline-capable — no API server needed for inter-agent communication
4. Long-horizon autonomy — roles run continuously across sessions via /loop

**Where EvoMesh should not try to compete**:
1. Real-time, high-throughput pipelines (CrewAI Flows)
2. Single-session task completion (Agent SDK, OpenHands)
3. Enterprise API orchestration (A2A protocol)

---

## Recommendations

1. **Evaluate Agent SDK for intra-role subtasks** → agent-architect: Each role could use `claude-agent-sdk` for complex operations within a single loop (e.g., research role spawning parallel searches, frontend role running multiple code changes). This is additive, not a replacement.

2. **Monitor Agent SDK for persistence features** → research (self): If Anthropic adds file-based or git-based persistence to the Agent SDK, this changes EvoMesh's competitive landscape significantly. Check SDK changelog every monitoring loop.

3. **Leverage /loop + 1M context officially in architecture** → agent-architect: EvoMesh roles are already running via /loop. Document this as the recommended execution method in ROLE.md templates. The 1M context window means roles can process larger codebases per loop.

4. **Note for agent-architect**: The protocol-v2 proposal already incorporates research recommendations (metrics.log, self-evolution protocol, append-only shared docs). This feedback loop is working as designed — research → lead → agent-architect pipeline is functional.

5. **No action needed on framework landscape** → lead: No new file-based frameworks have emerged. EvoMesh's differentiator is intact. Market is consolidating around API-based approaches, which validates our niche.
