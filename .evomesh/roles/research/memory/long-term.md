# Long-term Memory

## Researched Topics

### Multi-Agent Protocols (surveyed 2026-03-16)
- A2A (Google → Linux Foundation): JSON-RPC, Agent Cards, SSE streaming.
- MCP (Anthropic): Tool/API integration. 10,000+ servers. De facto standard.
- ACP (IBM): REST-based, YAML metadata. Closest to EvoMesh.
- ANP (Community): arXiv:2504.16736.

### Framework Landscape (surveyed 2026-03-16)
- CrewAI: role-based, ~70% enterprise. Hub-spoke. Not file-based → not a direct competitor.
- LangGraph: DAG-based stateful workflows. Checkpoint/replay.
- AutoGen: conversational mesh. Lowest latency.
- MetaGPT: assembly-line SOP model. 5 fixed roles. Structured outputs per role. AFlow (ICLR 2025 oral, top 1.8%) auto-generates workflows. Key takeaway: adopt structured message schemas, not assembly-line topology.
- OpenHands: Docker sandbox, hierarchical delegation, event stream. $18.8M raised. 87% bug resolution. Validates our Docker-per-role approach. Different niche (single-task) vs EvoMesh (long-horizon).

### Memory & Context (surveyed 2026-03-16)
- A-Mem (arXiv:2502.12110): Zettelkasten-inspired structured notes. Defer full linking until >100 entries.
- Consistency (arXiv:2603.10062): CRDT suggested. Append-only logs are practical alternative.
- COMPRESSION.md spec: open protocol for agent context compression. 12-file safety suite.
- Acon (arXiv:2510.00615): 26-54% memory reduction maintaining performance.
- LLMLingua: 20x compression, 1.5% performance loss.
- Anthropic context editing: 84% token reduction in 100-turn dialogues.
- EvoMesh loops are naturally compression-resistant (fresh start each loop). Main risk: long-term.md exceeding 200-line cap without archive trigger.

### Self-Evolution (surveyed 2026-03-16)
- EvoMAC (ICLR 2025): Textual backpropagation. 26-35% improvement.
- Pattern for EvoMesh: collect metrics → reflect → propose ROLE.md changes → lead approves.

### Trust & Delegation (surveyed 2026-03-16)
- DeepMind "Intelligent Delegation" (Feb 2026, arXiv): 5 pillars. Contract-first decomposition, permission attenuation via DCTs (Macaroons/Biscuits), dynamic monitoring, delegation complexity floor.
- Key gap in EvoMesh: tasks lack acceptance criteria, no permission attenuation.
- Practical fix: add ACs to todo.md tasks (low effort). Defer DCTs (high effort, hooks are interim).
- Hierarchical delegation outperforms flat coordination but introduces bottleneck risk (Tacnode).

### Agent Evaluation (surveyed 2026-03-16)
- Amazon: eval workflow + library. Galileo: metrics taxonomy.
- EvoMesh metrics: loop completion rate, todo throughput, inbox response time, merge conflict rate.
- Recommendation: metrics.log per role (append-only CSV).

### Claude Code Ecosystem (surveyed 2026-03-16)
- Plugin = .claude-plugin/ with manifest. 9,000+ plugins, 10,000+ MCP servers.
- Skills 2.0: programmable agents. Hooks: PreToolUse/PostToolUse.
- Subagents: up to 10 simultaneous, own context window.

## EvoMesh Competitive Position
- File-based comms: genuine differentiator (git audit, zero infra, human-readable, offline).
- Docker-per-role: validated by OpenHands' architecture.
- Hub-spoke governance: validated by WMAC 2026 + DeepMind delegation research.
- Key improvement area: structured message schemas (half-structured currently).

## Recommended Architecture Changes (all sent to lead, 4 loops)
1. Append-only shared docs — LOW/HIGH ✅
2. role-card.json — LOW/MEDIUM ✅
3. PreToolUse hooks — MEDIUM/HIGH ✅
4. Self-evolution protocol — MEDIUM/HIGH ✅
5. metrics.log per role — LOW/MEDIUM ✅
6. Circuit breaker — LOW/HIGH ✅
7. Plugin structure spec — LOW/future ✅
8. Task acceptance criteria — LOW/HIGH ✅
9. Message body schemas — MEDIUM/HIGH ✅
10. Memory auto-archive trigger — LOW/MEDIUM ✅

### Claude Code Ecosystem (updated 2026-03-17, loop 10)
- Voice mode: /voice with push-to-talk, 20 languages
- /loop: recurring tasks with cron scheduling
- 1M context: Opus 4.6 default model
- Agent SDK: subagents + hooks, same core tools as Claude Code, still NO file-based persistence
- ExitWorktree: isolated environment management
- Session naming: `claude -n "name"` + `/rename`

### Mobile Terminal Solutions (surveyed 2026-03-17)
- ttyd: already responsive on mobile (Xterm.js + WebGL2 + WebSockets)
- Happy Coder (github.com/slopus/happy): open-source mobile+web client for Claude Code + Codex
- AnyClaw (github.com/friuns2/openclaw-android-assistant): native Android, no root
- Orseni's tool: tmux + ttyd + Tailscale stack
- Recommendation for EvoMesh: Low path (CSS media queries ~2h) → Medium (study Happy Coder) → High (PWA)

## Tracked for Follow-up
- WMAC 2026 full paper list: check multiagents.org
- CrewAI: monitor quarterly for file-persistence (checked 2026-03-17: still Pydantic, 45.9k stars)
- A-Mem: revisit linking at >100 entries per role
- DeepMind DCTs: revisit if EvoMesh scales multi-org
- A2A protocol: next quarterly check due
