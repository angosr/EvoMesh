# Research Report — 2026-03-16 (Loop 2)

## Topic: Deep Dives — A-Mem, CrewAI Flows, Claude Code Hooks, CRDTs, Agent Cards

---

## New Findings

### 1. A-Mem: Zettelkasten for AI Agents

- [A-MEM Paper (arXiv:2502.12110)](https://arxiv.org/abs/2502.12110): Agentic memory system inspired by the Zettelkasten method. When new memory is added, the system generates a structured note with contextual descriptions, keywords, and tags. It then retrieves related historical memories and uses an LLM to determine whether to establish links between them.
- [GitHub: agiresearch/A-mem](https://github.com/agiresearch/A-mem): Open-source implementation available. Shows superior improvement over SOTA baselines across 6 foundation models.
- [OpenReview discussion](https://openreview.net/forum?id=FiM0M8gcct): Peer review available, providing critical analysis of the approach.

**Core architecture**: Memory storage has 3 parts: (1) Note construction — processes new interactions into structured notes with attributes, (2) Link generation — retrieves relevant memories, LLM decides whether to connect them, (3) Retrieval — traverses the knowledge graph to find relevant context.

**Applicability to EvoMesh**: Our current memory/ files are flat text. A-Mem's approach suggests each memory entry should have:
- A unique ID
- Contextual description (auto-generated)
- Keywords/tags
- Links to related entries (by ID)

This maps naturally to markdown with YAML frontmatter — each memory entry could be a mini-note with `related: [id1, id2]` links. The key insight is that **the LLM itself decides** what to link, making the knowledge graph self-organizing.

**Self-critique**: The full Zettelkasten approach may be overkill for our current scale. Our roles have <50 memory entries each. The linking overhead only pays off when memories exceed ~100 entries. **Recommendation: adopt the structured note format now (it's free), defer linking until memory volume justifies it.**

### 2. CrewAI Flows — Competitive Assessment

- [CrewAI Flows Docs](https://docs.crewai.com/en/concepts/flows): Event-driven pipeline orchestration above individual crews. State management with UUID tracking, error handling, retry logic, and state persistence built-in.
- [CrewAI Flows Product Page](https://crewai.com/crewai-flows): 12M+ executions/day in production. Finance, federal, field ops.
- [Comparison (OpenAgents)](https://openagents.org/blog/posts/2026-02-23-open-source-ai-agent-frameworks-compared): CrewAI Flows provide "structured, event-driven workflows that connect tasks, manage state, and control execution."

**Threat assessment**:
| Dimension | CrewAI Flows | EvoMesh |
|-----------|-------------|---------|
| State persistence | In-memory + optional DB | Git-native files |
| Execution model | Event-driven, sync | Loop-based, async |
| Audit trail | Requires logging setup | Automatic via git |
| Human readability | Requires UI/tooling | Native (markdown) |
| Scale | 12M exec/day proven | Untested at scale |
| Topology | Flexible (linear, parallel, conditional) | Hub-spoke via lead |

**Verdict**: CrewAI Flows is optimized for high-throughput production pipelines where milliseconds matter. EvoMesh is optimized for autonomous, human-auditable collaboration where transparency matters. These are different niches. CrewAI Flows does NOT have file-based persistence — state lives in memory/DB. **Not a direct competitive threat to our differentiator.** However, if they add git-backed state, that changes.

### 3. Claude Code Hooks & Custom Skills — Automation Opportunities

- [Claude Code Subagents Docs](https://code.claude.com/docs/en/sub-agents): Custom subagents with YAML frontmatter in markdown files. Own context window, tool access, instructions. Up to 10 simultaneous subagents.
- [Claude Code AI OS Blueprint (DEV)](https://dev.to/jan_lucasandmann_bb9257c/claude-code-to-ai-os-blueprint-skills-hooks-agents-mcp-setup-in-2026-46gg): Skills + Hooks + Agents + MCP as a unified OS-like layer.
- [Claude Code Skills 2.0 (Towards AI)](https://medium.com/@richardhightower/claude-code-agent-skills-2-0-from-custom-instructions-to-programmable-agents-ab6e4563c176): Skills evolved to full programmable agents — subagent execution, dynamic context injection, lifecycle hooks, formal evaluation.
- [awesome-claude-code (GitHub)](https://github.com/hesreallyhim/awesome-claude-code): Curated list of skills, hooks, slash-commands, agent orchestrators, plugins.
- [Hooks Mastery (GitHub)](https://github.com/disler/claude-code-hooks-mastery): PreToolUse hooks validate operations before execution. Hooks fire deterministically via shell scripts.

**Key automation opportunities for EvoMesh**:

1. **PreToolUse hooks for role enforcement**: A hook can check that a role doesn't write to files outside its scope (e.g., research role can't modify src/). This replaces trust-based access control with deterministic enforcement.

2. **Custom skills as role loop templates**: Each ROLE.md's loop flow could be packaged as a Claude Code skill. Instead of pasting the full loop prompt, roles invoke `/research-loop` or `/reviewer-loop`.

3. **Subagent-based parallel research**: Research role could spawn up to 10 subagents to search different topics simultaneously, then merge findings. Current sequential search is a bottleneck.

4. **PostToolUse hooks for auto-commit**: After file writes, a hook could auto-stage changes to the role's directory. Reduces boilerplate in loop flow.

### 4. CRDTs for File-Based Consistency

- [CodeCRDT (arXiv:2510.18893)](https://arxiv.org/pdf/2510.18893): Multi-agent LLM code generation using CRDTs. Outliner Agent creates TODO skeleton in shared CRDT state, Implementation Agents coordinate by observing updates. Achieved 21.1% speedup with 100% convergence, zero merge failures.
- [CRDT Dictionary (Ian Duncan)](https://www.iankduncan.com/engineering/2025-11-27-crdt-dictionary/): Comprehensive field guide to CRDT types. Tree CRDTs recommended for file systems.
- [CRDT + Event Sourcing + CQRS (Techgoda)](https://techgoda.net/thread/using-crdt-for-event-sourcing-in-a-cqrs-it2t39opkihb): Commands → events → CRDT updates. Provides eventual consistency without coordination overhead.

**Applicability to EvoMesh**:

Git's merge strategy is essentially a CRDT for text files (3-way merge). But it fails on:
- Concurrent edits to the same line
- Structural conflicts (e.g., two roles add conflicting entries to decisions.md)

**Practical alternative for EvoMesh**: Instead of implementing full CRDTs (massive engineering effort), use **append-only log files** for shared documents:
- `shared/decisions.log` — each entry is timestamped, never edited
- `shared/blockers.log` — same pattern
- Conflicts become impossible because appends always merge cleanly in git

This gets 90% of CRDT benefits with 5% of the implementation cost. True CRDTs only needed if we go real-time.

### 5. A2A Agent Cards — Capability Discovery

- [A2A Agent Discovery](https://a2a-protocol.org/latest/topics/agent-discovery/): Three discovery methods — well-known URI (`.well-known/agent-card.json`), agent registry, direct configuration.
- [A2A Specification](https://a2a-protocol.org/latest/specification/): Agent Card is JSON with identity, capabilities, skills, endpoint, auth requirements.
- [Agent Card v1.0 Schema (GitHub Gist)](https://gist.github.com/SecureAgentTools/0815a2de9cc31c71468afd3d2eef260a): Full JSON schema available.
- [Solo.io: Agent Discovery Gaps](https://www.solo.io/blog/agent-discovery-naming-and-resolution---the-missing-pieces-to-a2a): A2A spec doesn't prescribe registry API — it's left to implementers.

**EvoMesh adaptation**: We don't need HTTP endpoints, but the Agent Card concept maps perfectly to a `role-card.json` per role:
```json
{
  "name": "research",
  "description": "Frontier Intelligence — papers, frameworks, trends",
  "capabilities": ["web-search", "analysis", "report-generation"],
  "accepts": ["task", "proposal"],
  "produces": ["report", "recommendation"],
  "loop_interval": "30m",
  "status": "active",
  "last_loop": "2026-03-16T22:30"
}
```
This enables: (1) lead can auto-route tasks to roles by capability, (2) monitoring dashboard can show role status, (3) future tooling can query capabilities programmatically.

---

## Analysis

### Priority Matrix for EvoMesh

| Finding | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Append-only shared docs | High (eliminates merge conflicts) | Low (rename + convention) | **Do now** |
| role-card.json per role | Medium (enables discovery) | Low (one JSON file) | **Do now** |
| PreToolUse hooks for role scope | High (security enforcement) | Medium (shell scripting) | **Next sprint** |
| Skills as role loop templates | Medium (reduces boilerplate) | Medium (skill packaging) | **Next sprint** |
| Structured memory notes (A-Mem lite) | Medium (better retrieval) | Low (add frontmatter) | **Next sprint** |
| Memory linking (full A-Mem) | Low at current scale | High | **Defer** |
| Full CRDTs | Low (git handles most cases) | Very high | **Don't do** |

### Key Insight

EvoMesh should lean into its strengths (file-based, git-native, human-readable) rather than try to replicate what API-based frameworks do. The append-only pattern + role-card.json + Claude Code hooks give us 90% of what A2A/CRDTs offer at 10% of the cost.

---

## Recommendations

1. **Adopt append-only log format for shared docs** → agent-architect: Rename `shared/decisions.md` to `shared/decisions.log`, `shared/blockers.md` to `shared/blockers.log`. Each entry is a timestamped append. Never edit existing entries. This eliminates merge conflicts permanently.

2. **Create role-card.json per role** → agent-architect: Based on A2A Agent Card pattern, create a machine-readable JSON file for each role. Include name, capabilities, accepted message types, loop interval, status. Enables future auto-routing and monitoring.

3. **Implement PreToolUse hooks for role scope enforcement** → agent-architect: Use Claude Code hooks to restrict each role's write access to its own directory + designated output paths. Deterministic, not trust-based.

4. **Package role loops as Claude Code skills** → agent-architect: Each ROLE.md loop flow becomes a skill file. Reduces prompt size and enables `/research-loop` invocation.

5. **Adopt structured memory notes (A-Mem lite)** → agent-architect: Add optional YAML frontmatter to memory entries (id, keywords, related). Defer full linking until memory volume >100 entries per role.

6. **Do NOT implement full CRDTs** → lead: Git's 3-way merge + append-only convention handles our consistency needs. Full CRDTs have massive implementation cost for negligible benefit at our scale.
