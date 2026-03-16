# Research Report — 2026-03-16

## Topic: Initial Landscape Survey — Multi-Agent Systems, Protocols & Memory

---

## New Findings

### 1. Multi-Agent Orchestration Protocols (The Big Four)

- [A2A Protocol (Google → Linux Foundation)](https://a2a-protocol.org/latest/specification/): Agent-to-Agent protocol using JSON-RPC, Agent Cards for capability discovery, SSE for streaming. Now under Linux Foundation governance. Supports opaque agents — no shared internals needed.
- [MCP (Anthropic)](https://arxiv.org/html/2505.02279v1): Model Context Protocol — standardizes how agents interact with tools/databases/APIs. De facto standard within 1 year of launch. 10,000+ MCP servers in ecosystem.
- [ACP (IBM)](https://www.ruh.ai/blogs/ai-agent-protocols-2026-complete-guide): Agent Communication Protocol — lightweight REST-based alternative. Agents publish metadata at well-known URIs via YAML. Works when agents are offline.
- [ANP (Community)](https://arxiv.org/abs/2504.16736): Agent Network Protocol — community-driven, surveyed in "A Survey of AI Agent Protocols" (arXiv:2504.16736).

**Relevance to EvoMesh**: EvoMesh uses file-based communication (markdown + YAML frontmatter in inbox/ directories). This is closest in spirit to ACP's "YAML at well-known URIs" pattern, but without HTTP. Industry is converging on multi-protocol coexistence (like HTTP/WebSocket/gRPC in web infra). EvoMesh's approach has unique strengths: git-native versioning, works offline, human-readable, zero infrastructure needed.

### 2. Framework Comparison (AutoGen, CrewAI, LangGraph, OpenHands)

- [Framework comparison (DataCamp)](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen): CrewAI = role-based crews; LangGraph = stateful graph workflows; AutoGen = conversational multi-agent.
- [OpenAgents comparison](https://openagents.org/blog/posts/2026-02-23-open-source-ai-agent-frameworks-compared): CrewAI dominates enterprise adoption (~70% of AI-native business workflows by Jan 2026).
- [Comprehensive framework list (Arsum)](https://arsum.com/blog/posts/ai-agent-frameworks/): 12+ frameworks compared including MetaGPT, OpenDevin.
- [Performance benchmarks (DEV Community)](https://dev.to/synsun/autogen-vs-langgraph-vs-crewai-which-agent-framework-actually-holds-up-in-2026-3fl8): LangChain most token-efficient; AutoGen lowest latency; CrewAI heaviest resource profile.

**Communication topologies**:
| Framework | Topology | Communication |
|-----------|----------|---------------|
| CrewAI | Hub-spoke (manager) + peer tasks | Shared context object, API-based |
| LangGraph | DAG (directed graph) | State passed along edges |
| AutoGen | Mesh (conversational) | Message passing between agents |
| EvoMesh | Hub-spoke (lead) | File-based inbox/outbox via git |

**Relevance**: EvoMesh's hub-spoke via lead mirrors CrewAI's manager pattern. Key difference: EvoMesh is async + persistent (files on disk) while CrewAI is sync + ephemeral (in-memory). EvoMesh advantage: full audit trail via git history.

### 3. Memory Architecture Research

- [A-Mem: Agentic Memory for LLM Agents (arXiv:2502.12110)](https://arxiv.org/pdf/2502.12110): Memories autonomously evolve structure — generate own descriptions, form connections, update relationships. Directly relevant to EvoMesh's memory/ design.
- [Multi-Agent Memory from Computer Architecture Perspective (arXiv:2603.10062)](https://arxiv.org/html/2603.10062): Frames multi-agent memory as a classical consistency problem. Multiple agents reading/writing shared memory raises visibility, ordering, and conflict resolution challenges.
- [Oracle: File Systems vs Databases for Agent Memory](https://blogs.oracle.com/developers/comparing-file-systems-and-databases-for-effective-ai-agent-memory-management): Compares file-based vs DB-based memory. File systems work for simpler setups but face race conditions under concurrent writes.
- [Microsoft Multi-Agent Reference Architecture](https://microsoft.github.io/multi-agent-reference-architecture/docs/memory/Memory.html): Dual-tier: private memory + shared memory. Short-term for task context, long-term for persistent knowledge.
- [Mem0 (arXiv:2504.19413)](https://arxiv.org/pdf/2504.19413): Production-ready long-term memory for AI agents. Scalable approach.

**Relevance**: EvoMesh already uses the dual-tier pattern (short-term.md + long-term.md). The consistency problem is real — if two roles edit shared/decisions.md simultaneously, git merge is our only conflict resolution. The arXiv:2603.10062 paper suggests CRDTs or event sourcing for this.

### 4. Claude Code Ecosystem

- [Claude Code Skills/MCP/Plugins Guide](https://www.morphllm.com/claude-code-skills-mcp-plugins): Skills = procedural knowledge (30-50 tokens), MCP = external tool connections (50k+ tokens), Plugins = bundles of all three.
- [Best MCP Servers](https://claudefa.st/blog/tools/mcp-extensions/best-addons): 10,000+ MCP servers available. Key ones: GitHub, Context7 (live docs), browser automation.
- [Claude Code Plugins](https://www.morphllm.com/claude-code-plugins): 9,000+ plugins available. Plugin = slash commands + subagents + MCP configs + hooks + skills.

**Relevance**: EvoMesh runs Claude Code instances per role. Each role could benefit from role-specific MCP servers (e.g., reviewer gets GitHub MCP, research gets web search MCP). Plugin system could package EvoMesh role definitions.

### 5. Industry Trends

- [AAAI 2026 Workshop on Multi-Agent Collaboration (WMAC)](https://multiagents.org/2026/): Academic focus on bridging LLMs and multi-agent systems. Held Jan 2026 in Singapore.
- [Gartner: 1,445% surge](https://www.rtinsights.com/if-2025-was-the-year-of-ai-agents-2026-will-be-the-year-of-multi-agent-systems/) in multi-agent system inquiries Q1 2024→Q2 2025.
- [7 Agentic AI Trends 2026](https://machinelearningmastery.com/7-agentic-ai-trends-to-watch-in-2026/): Self-evolving agents, memory engineering, protocol standardization are top trends.

---

## Analysis

### EvoMesh's Position in the Landscape

**Strengths of file-based communication (vs API/RPC)**:
1. **Git-native audit trail** — every message is version-controlled. No other framework has this by default.
2. **Zero infrastructure** — no message broker, no API server for inter-agent comms. Just a filesystem.
3. **Human-readable** — anyone can inspect agent state by reading markdown files. CrewAI/AutoGen require debugging tools.
4. **Offline-capable** — agents don't need network connectivity to read/write messages.
5. **Closest to ACP's "YAML at well-known URIs"** pattern, which IBM designed for exactly this kind of discoverable, offline-capable agent metadata.

**Weaknesses to address**:
1. **No real-time signaling** — agents poll on loop intervals, can't interrupt each other. A2A supports SSE for this.
2. **Concurrency risk** — two roles writing to same file simultaneously. Git merge helps but isn't atomic. The arXiv:2603.10062 paper's CRDT suggestion is worth exploring.
3. **No capability discovery** — A2A's Agent Card pattern lets agents find each other's capabilities. EvoMesh roles are statically defined in ROLE.md.
4. **No cross-project communication** — A2A enables agents across organizations to collaborate. EvoMesh is single-project.

### Self-Evolving Systems

EvoMesh's `evolution.log` and the reviewer role's feedback loop are early self-evolution mechanisms. The A-Mem paper's approach (memories autonomously form connections and evolve) could enhance our memory/ system. Currently our memory is flat text; structured linking between memories would enable better knowledge retrieval.

---

## Recommendations

1. **Add Agent Card concept** → agent-architect: Create a machine-readable `agent-card.json` per role (inspired by A2A) containing capabilities, accepted message types, and current status. This enables future tooling to auto-route messages.

2. **Implement file-locking or append-only patterns** → agent-architect: For shared files (decisions.md, blockers.md), switch to append-only log format to avoid merge conflicts. Each entry is a timestamped append, never an edit of existing content.

3. **Role-specific MCP server configs** → lead: Each role container should include MCP servers relevant to its function (research → web search, reviewer → GitHub, frontend → browser). This is low-effort, high-value.

4. **Explore structured memory linking** → agent-architect: Based on A-Mem paper, add optional `related` field to memory entries so memories can reference each other. Helps with knowledge retrieval across loops.

5. **Don't adopt A2A/ACP yet** → lead: The file-based approach is a genuine differentiator. Switching cost is very high and the benefits (real-time, cross-org) aren't needed at current scale. Revisit when EvoMesh supports multi-project orchestration.

6. **Monitor CrewAI's "Flows" feature** → research (self): CrewAI Flows allow mixing role-based crews with stateful graphs. If they add file-based persistence, they become a direct competitor. Track quarterly.
