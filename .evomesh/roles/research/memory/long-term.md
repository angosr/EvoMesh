# Long-term Memory

## Researched Topics

### Multi-Agent Protocols (surveyed 2026-03-16)
- A2A (Google → Linux Foundation): JSON-RPC, Agent Cards, SSE streaming. Most enterprise momentum.
- MCP (Anthropic): Tool/API integration standard. 10,000+ servers. De facto standard.
- ACP (IBM): REST-based, YAML metadata at well-known URIs. Closest to EvoMesh's file-based approach.
- ANP (Community): Surveyed in arXiv:2504.16736.
- Industry consensus: multi-protocol coexistence (like HTTP/WS/gRPC).

### Framework Landscape (surveyed 2026-03-16)
- CrewAI: role-based, ~70% enterprise adoption. Hub-spoke topology. Heaviest resource usage.
- LangGraph: DAG-based stateful workflows. Most flexible. Checkpoint/replay.
- AutoGen: conversational mesh. Lowest latency. No-code Studio option.
- OpenHands/Aider: less prominent in 2026 comparisons, more specialized.

### Memory Architecture Research (surveyed 2026-03-16)
- A-Mem (arXiv:2502.12110): memories autonomously evolve structure + form connections.
- Multi-agent memory consistency (arXiv:2603.10062): frames as classical CS consistency problem. CRDTs suggested.
- Oracle comparison: file-based memory works for simple setups, faces race conditions at scale.
- Microsoft reference arch: dual-tier (private + shared), short-term + long-term pattern.
- Mem0 (arXiv:2504.19413): production-ready long-term memory.

### Claude Code Ecosystem (surveyed 2026-03-16)
- Skills: procedural, 30-50 tokens, on-demand.
- MCP: external tool connections, lazy-loaded.
- Plugins: bundles of skills + MCP + hooks + subagents. 9,000+ available.
- Key insight: role-specific MCP configs would benefit EvoMesh roles.

## EvoMesh Competitive Position
- File-based comms is a genuine differentiator (git audit trail, zero infra, human-readable, offline).
- Weaknesses: no real-time signaling, concurrency risk on shared files, no capability discovery.
- Closest industry parallel: ACP's YAML-at-well-known-URIs pattern.

## Tracked for Follow-up
- CrewAI Flows feature — potential competitive threat if they add file persistence
- A-Mem structured memory linking — could enhance our memory/ system
- Claude Code hooks/skills — automation opportunities for EvoMesh
