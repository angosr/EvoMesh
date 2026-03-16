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
- CrewAI Flows: event-driven pipelines, 12M exec/day, NOT file-based. Not a direct competitor.
- LangGraph: DAG-based stateful workflows. Checkpoint/replay.
- AutoGen: conversational mesh. Lowest latency. No-code Studio option.

### Memory Architecture (surveyed 2026-03-16)
- A-Mem (arXiv:2502.12110): Zettelkasten-inspired structured notes with auto-linking.
- Multi-agent memory consistency (arXiv:2603.10062): classical CS consistency problem. CRDTs suggested.
- Append-only log pattern: 90% of CRDT benefits at 5% cost for EvoMesh.

### Self-Evolution Mechanisms (surveyed 2026-03-16)
- EvoMAC (ICLR 2025): Textual backpropagation — feedback propagated as NL to update agent prompts. 26-35% improvement. Directly analogous to EvoMesh's inbox feedback system.
- SICA: Self-improving coding agent that edits own codebase. Too risky for EvoMesh — prefer eval-then-propose pattern.
- GEPA: Genetic-Pareto framework. Evolutionary prompt optimization.
- Meta-prompting (APE method): generate candidate prompts → score → select best.
- OpenAI Cookbook: eval-driven self-evolution loop (run → evaluate → reflect → revise).
- aiXplain Evolver: commercial meta-agent for prompt/tool optimization.
- Key design for EvoMesh: collect metrics → reflect → propose ROLE.md changes → lead approves → update. Safe because of hub-spoke governance.

### Claude Code Plugin System (surveyed 2026-03-16)
- Plugin = .claude-plugin/ dir with plugin.json manifest
- Bundles: slash commands, subagents, MCP servers, hooks
- Marketplace: git repo + marketplace.json. Install via `/plugin marketplace add`
- EvoMesh roles map to plugins: skill (loop flow) + agent (role def) + hooks (scope guard) + MCP (role-specific tools)
- Status: design spec now, package later (~3-4 sprints when roles stabilize)

### WMAC 2026 / Academic (surveyed 2026-03-16)
- AAAI 2026 Bridge Program, Jan 20, Singapore
- "Agentifying Agentic AI" (arXiv:2511.17332): explicit governance models needed. Cascading errors a top risk.
- Themes: governance, social norms, evaluation, cascading error prevention
- Validates EvoMesh: hub-spoke governance, reviewer safety net, base-protocol as social norms

### Agent Evaluation (surveyed 2026-03-16)
- Amazon: generic eval workflow + agent eval library. Measures tool selection, reasoning, task completion.
- Galileo: metrics taxonomy — behavior, capabilities, reliability, safety.
- Tools: LangSmith, Weave, DeepEval for production monitoring.
- GAIA benchmark for general AI assistant evaluation.
- EvoMesh-specific metrics proposed: loop completion rate, todo throughput, inbox response time, merge conflict rate, reviewer catch rate, self-evolution rate.
- Recommendation: metrics.log per role (append-only CSV), instrument now, analyze later.

## EvoMesh Competitive Position
- File-based comms is genuine differentiator (git audit, zero infra, human-readable, offline).
- Hub-spoke governance validated by WMAC 2026 academic research.
- Self-evolution opportunity: inbox system is already textual backpropagation.

## Recommended Architecture Changes (all sent to lead)
1. Append-only shared docs — LOW effort, HIGH impact ✅ sent loop 2
2. role-card.json per role — LOW effort, MEDIUM impact ✅ sent loop 2
3. PreToolUse hooks for role scope — MEDIUM effort, HIGH impact ✅ sent loop 2
4. Self-evolution protocol — MEDIUM effort, HIGH impact ✅ sent loop 3
5. metrics.log per role — LOW effort, MEDIUM impact ✅ sent loop 3
6. Circuit breaker mechanism — LOW effort, HIGH impact ✅ sent loop 3
7. Plugin structure spec — LOW effort, future value ✅ sent loop 3

## Tracked for Follow-up
- WMAC 2026 full paper list: not yet published, check multiagents.org periodically
- CrewAI: monitor quarterly for file-persistence features
- A-Mem: revisit linking when memory volume >100 entries per role
- Claude Code hooks: github.com/disler/claude-code-hooks-mastery
- awesome-claude-code: github.com/hesreallyhim/awesome-claude-code
