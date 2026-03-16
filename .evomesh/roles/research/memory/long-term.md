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
- CrewAI Flows: event-driven pipelines, 12M exec/day, state persistence in memory/DB (NOT file-based). Not a direct competitor.
- LangGraph: DAG-based stateful workflows. Most flexible. Checkpoint/replay.
- AutoGen: conversational mesh. Lowest latency. No-code Studio option.
- OpenHands/Aider: less prominent in 2026 comparisons, more specialized.

### Memory Architecture Research (surveyed 2026-03-16)
- A-Mem (arXiv:2502.12110): Zettelkasten-inspired. Structured notes with contextual descriptions, keywords, tags, auto-linking. Open-source at github.com/agiresearch/A-mem.
  - Key insight: LLM decides what to link, making knowledge graph self-organizing.
  - EvoMesh adoption: structured note format (frontmatter) now, defer linking until >100 entries per role.
- Multi-agent memory consistency (arXiv:2603.10062): frames as classical CS consistency problem. CRDTs suggested.
- Oracle comparison: file-based memory works for simple setups, faces race conditions at scale.
- Microsoft reference arch: dual-tier (private + shared), short-term + long-term pattern.
- Mem0 (arXiv:2504.19413): production-ready long-term memory.

### CRDT / Consistency (surveyed 2026-03-16)
- CodeCRDT (arXiv:2510.18893): CRDT for multi-agent code generation. 21.1% speedup, 100% convergence, zero merge failures.
- Full CRDTs: massive implementation cost, NOT recommended for EvoMesh.
- Append-only log pattern: 90% of CRDT benefits at 5% cost. Git appends always merge cleanly.
- Tree CRDTs exist for file systems but are overkill for our use case.

### A2A Agent Cards (surveyed 2026-03-16)
- JSON capability discovery at `.well-known/agent-card.json`
- Three discovery methods: well-known URI, agent registry, direct config.
- A2A spec doesn't prescribe registry API — left to implementers.
- EvoMesh adaptation: `role-card.json` per role with name, capabilities, accepted types, status, loop interval.

### Claude Code Ecosystem (surveyed 2026-03-16)
- Skills: procedural, 30-50 tokens, on-demand. Evolved to programmable agents in Skills 2.0.
- Hooks: PreToolUse/PostToolUse shell scripts. Deterministic control over tool execution.
- Subagents: custom markdown + YAML frontmatter. Own context window. Up to 10 simultaneous.
- Plugins: bundles of skills + MCP + hooks + subagents. 9,000+ available.
- Key automation opportunities for EvoMesh:
  1. PreToolUse hooks for role scope enforcement (security)
  2. Skills as role loop templates (reduce boilerplate)
  3. Subagent-based parallel research
  4. PostToolUse hooks for auto-staging commits

## EvoMesh Competitive Position
- File-based comms is a genuine differentiator (git audit trail, zero infra, human-readable, offline).
- Weaknesses: no real-time signaling, concurrency risk on shared files, no capability discovery.
- Closest industry parallel: ACP's YAML-at-well-known-URIs pattern.
- CrewAI Flows is NOT a direct competitor (different niche: sync pipelines vs async collaboration).

## Recommended Architecture Changes (sent to lead)
1. Append-only shared docs (eliminates merge conflicts) — LOW effort, HIGH impact
2. role-card.json per role (capability discovery) — LOW effort, MEDIUM impact
3. PreToolUse hooks for role scope (security) — MEDIUM effort, HIGH impact
4. Skills as role loop templates — MEDIUM effort, MEDIUM impact
5. Structured memory notes (A-Mem lite) — LOW effort, MEDIUM impact

## Tracked for Follow-up
- CrewAI: monitor quarterly for file-persistence features
- A-Mem: revisit linking when memory volume >100 entries per role
- Claude Code hooks: watch github.com/disler/claude-code-hooks-mastery for patterns
- awesome-claude-code: github.com/hesreallyhim/awesome-claude-code for new skills/plugins
