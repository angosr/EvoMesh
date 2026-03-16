# Research Report — 2026-03-16: Multi-Agent Protocol Design

## 1. Framework Communication Protocols Compared

### CrewAI — Role-Based Sequential
- **Topology**: Sequential pipeline or hierarchical (manager delegates)
- **Communication**: Task outputs passed from one agent to next; no direct agent-to-agent messaging
- **State**: Shared crew context object; tasks write results to it
- **Enforcement**: Framework validates task completion before passing to next agent
- **Relevance to EvoMesh**: Our role-based design is similar, but we use file-based messaging instead of in-memory passing. CrewAI's sequential pipeline is too rigid for us — we need concurrent roles.

### AutoGen — Conversational
- **Topology**: Group chat with orchestrated turn-taking
- **Communication**: Agents exchange messages in a shared conversation; orchestrator selects next speaker
- **State**: Conversation history IS the shared state
- **Enforcement**: GroupChatManager controls who speaks when
- **Relevance to EvoMesh**: Conversation-based approach doesn't map well to file-based architecture. But the "orchestrator selects next speaker" pattern is interesting — similar to our lead dispatching tasks.

### LangGraph — Graph-Based State Machine
- **Topology**: Directed graph; nodes are agents, edges are transitions
- **Communication**: Central state object with reducer logic for concurrent updates
- **State**: Typed state dict with persistence layer (checkpoints)
- **Enforcement**: Graph structure constrains valid transitions; conditional edges for routing
- **Relevance to EvoMesh**: LangGraph's reducer pattern for merging concurrent state updates is directly applicable. Our `shared/decisions.md` has this exact concurrency problem. Also: LangGraph's checkpoint system = our memory/archive concept.

### Google A2A Protocol — Interoperability Standard
- **Topology**: Peer-to-peer with Agent Cards for discovery
- **Communication**: Standardized task interface (JSON-RPC)
- **State**: Task objects with lifecycle (submitted → working → completed/failed)
- **Relevance to EvoMesh**: Agent Cards concept → our proposed `role-card.json`. Task lifecycle states → inbox message `status` field. A2A is HTTP-based which we don't want, but the concepts are portable to file-based.

## 2. EvoMAC — Self-Evolution (ICLR 2025)

Key innovation: **textual backpropagation** — evaluate each agent's contribution to output, then update their prompts (or even connection topology) based on feedback.

**How it maps to EvoMesh:**
- We already have the pieces: ROLE.md = agent prompts, inbox = feedback channel, lead = evaluation node
- Missing: formalized feedback loop. Currently lead manually reviews and edits ROLE.md.
- **Proposed self-evolution protocol:**
  1. Each role logs metrics (tasks completed, errors, loop duration) → `metrics.log`
  2. Every N loops, role self-reflects: "what in my ROLE.md helped/hurt my performance?"
  3. Role proposes ROLE.md changes → lead inbox
  4. Lead evaluates + applies (or rejects with reason)
  5. Result recorded in `evolution.log`
- This is textual backpropagation via file-based communication — fits EvoMesh perfectly.

## 3. Memory Architecture — State of the Art

### Industry Consensus (2025-2026)
Three-tier hierarchy is standard:
1. **Working memory** (context window) — active reasoning
2. **Short-term memory** (session-scoped) — recent interactions, cleared periodically
3. **Long-term memory** (persistent) — cross-session knowledge, with pruning

### Key Insights
- **Selective storage is critical**: Indiscriminate saving degrades performance by 10%+. Must have salience detection.
- **Deletion is as important as addition**: Utility-based and retrieval-history-based deletion prevents bloat.
- **Compression over accumulation**: Summarize old entries when new evidence appears. Prevents context drift.

### Memory Storage Strategy for EvoMesh

**Recommendation: Hybrid approach (Modified B + D)**

| Memory Type | Storage | Git | Rationale |
|---|---|---|---|
| short-term.md | Project `.evomesh/` | `.gitignore` | Ephemeral, changes every loop, pollutes history |
| long-term.md | Project `.evomesh/` | Committed | Valuable knowledge, needs versioning, enables cross-machine sync |
| metrics.log | Project `.evomesh/` | `.gitignore` | Append-only, high frequency, analysis tool input |
| heartbeat.json | Project `.evomesh/` | `.gitignore` | Runtime state, changes every loop |

**Why not SQLite/JSON DB?** Violates EvoMesh's file-based simplicity. Markdown files are human-readable, git-diffable, and require no extra tooling. The performance gain from structured queries isn't worth the complexity at our scale (7 roles, <200 lines per file).

**Why not `~/.evomesh/memory/` global?** Memory is project-scoped. A role's knowledge about EvoMesh doesn't apply to a different project. Keep it project-local.

**Pruning protocol (D element):** AI self-cleans every 10 loops:
1. Re-read long-term.md
2. Score each entry: "Would this change my behavior in the next 10 loops?"
3. If no → archive to `memory/archive.md`
4. If contradicts newer entry → delete

## 4. Protocol Optimization Assessment

### Current base-protocol.md — Grade: B+
**Strengths:**
- Inbox format with threading adopted ✅
- Memory lifecycle with limits defined ✅
- P0 direct channel exception ✅
- Mandatory loop flow ✅

**Gaps to address:**
1. **No prompt hygiene section** (user requested)
2. **No self-evolution protocol** (EvoMAC-inspired)
3. **No metrics collection** (can't evolve without measurement)
4. **No append-only convention for shared docs** (concurrency risk)
5. **No role-card.json spec** (enables auto-routing)
6. **Inbox format may be over-specified** — 8 frontmatter fields is a lot. Consider: which fields do roles actually USE?

### Proposed base-protocol.md v2 changes

**Add:**
```markdown
## 8. Prompt Hygiene
- Every line in ROLE.md must produce observable behavior change. If not, delete it.
- Roles self-audit ROLE.md every 10 loops: remove dead rules, merge duplicates.
- base-protocol.md targets: <200 lines. Brevity = compliance.

## 9. Self-Evolution Protocol
- Each role maintains `metrics.log` (append-only CSV): timestamp, duration_s, tasks_done, errors, inbox_processed
- Every 10 loops: self-reflect on ROLE.md effectiveness → propose changes to lead
- Lead logs approved changes in role's `evolution.log`

## 10. Shared Document Conventions
- `shared/decisions.log` — append-only, timestamped, never edit existing lines
- `shared/blockers.md` — any role can write their own section
- Append-only format prevents git merge conflicts on concurrent writes
```

**Simplify inbox frontmatter** to 5 required + 3 optional:
```yaml
# Required
from: role-name
to: role-name
priority: P0|P1|P2
type: task|proposal|feedback|report|ack
date: YYYY-MM-DDTHH:MM
# Optional (only when needed)
thread-id: ...
ref: ...
status: pending|accepted|rejected|done
```

## 5. Project Creation Flow — Architecture Notes

For Central AI project scaffolding (separate detailed design needed):
- **Minimum viable role set**: lead + 1 executor (2 roles, not 7)
- **Project analysis**: read `package.json`/`Cargo.toml`/`go.mod` → infer stack → suggest roles
- **Template parameterization**: `{project_name}`, `{language}`, `{scope}` placeholders in role templates
- **Account distribution**: round-robin across available `~/.claude*` directories

This needs its own devlog entry — deferring to next loop.

## Sources
- [CrewAI vs LangGraph vs AutoGen comparison (OpenAgents 2026)](https://openagents.org/blog/posts/2026-02-23-open-source-ai-agent-frameworks-compared)
- [Framework comparison (DEV Community 2026)](https://dev.to/synsun/autogen-vs-langgraph-vs-crewai-which-agent-framework-actually-holds-up-in-2026-3fl8)
- [EvoMAC: Self-Evolving Multi-Agent Collaboration (ICLR 2025)](https://arxiv.org/abs/2410.16946)
- [Multi-Agent Memory from Computer Architecture Perspective (2026)](https://arxiv.org/html/2603.10062)
- [Mem0: Production-Ready Long-Term Memory (2025)](https://arxiv.org/pdf/2504.19413)
- [Memory Management for AI Agents (Medium 2025)](https://medium.com/@bravekjh/memory-management-for-ai-agents-principles-architectures-and-code-dac3b37653dc)
