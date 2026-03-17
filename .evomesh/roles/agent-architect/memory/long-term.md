# Long-term Memory

**能力摘要**: 多 agent 协作架构设计（通信协议、记忆系统、自演进、合规强制）。掌握 CrewAI/AutoGen/LangGraph/EvoMAC 研究、Claude Code hooks/skills 机制。

### Compliance Chain Attenuation（最重要的发现）
- 每层间接引用丢失 ~50% 遵守率（Layer 0: 95% → Layer 2: 50%）
- Hooks = 100% 遵守（系统层面强制，绕过 LLM 注意力）
- 关键规则放 prompt/ROLE.md 顶部，非关键规则放 base-protocol
- 不要依赖 LLM 自觉性保证关键行为 — 降级为系统强制

### 角色分类（主动 vs 被动）
- 主动型（lead, core-dev, frontend, agent-architect）：空闲时自我审查，持续轮询
- 被动型（reviewer, security, research）：空闲 5 轮后休眠，inbox 触发唤醒
- 不能一刀切 — 审查类角色必须持续运行，任务响应类可休眠

### EvoMesh's File-Based Architecture = Implicit Reducer Pattern
- Append-only files (decisions.md, metrics.log) = append reducer — git merges cleanly
- Single-writer files (blueprint.md, status.md) = last-write-wins — no conflict risk
- Per-role files (todo.md, short-term.md) = partitioned state — no conflicts by design
- Git commits = checkpoints — full state history, resumable
- Validated by LangGraph comparison (2026-03-17). No architectural changes needed.

### Key Framework Insights (CrewAI, AutoGen, LangGraph, EvoMAC)
- CrewAI: sequential pipeline, too rigid for concurrent roles
- AutoGen: conversation-based, doesn't map to file architecture
- LangGraph: graph + reducers, most applicable concepts
- EvoMAC (ICLR 2025): textual backpropagation — evaluate agent contribution → update prompts. Directly inspired our self-evolution protocol (section 9).

### base-protocol.md Design Principles
- Brevity = compliance. Target <250 lines.
- 5 required inbox fields, 3 optional. Don't over-specify.
- Memory: short-term gitignored (ephemeral), long-term committed (valuable)
- Append-only shared docs prevent merge conflicts
- Circuit breaker: 3 failures → auto-pause. Self-contained, no server dependency.

### Template Design Principles
- Templates ~3x shorter than code originals by referencing base-protocol for shared rules
- Minimum viable role set: lead + executor (always). Others optional based on project analysis.
- Central AI judges project type naturally (it's an LLM) — don't over-formalize classification
