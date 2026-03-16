# Long-term Memory

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
