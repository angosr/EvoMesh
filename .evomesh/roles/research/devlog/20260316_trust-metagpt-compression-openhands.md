# Research Report — 2026-03-16 (Loop 4)

## Topic: Inter-Agent Trust, MetaGPT, Context Compression, OpenHands/Devin

---

## New Findings

### 1. Inter-Agent Trust & Delegation — DeepMind Framework

- [DeepMind "Intelligent Delegation" Framework (Feb 2026)](https://theaiinsider.tech/2026/02/17/deepmind-study-proposes-rules-for-how-ai-agents-should-delegate/): Published arXiv Feb 12, 2026. Five pillars: Dynamic Assessment, Adaptive Execution, Structural Transparency, Scalable Market, Systemic Resilience.
- [MarkTechPost Analysis](https://www.marktechpost.com/2026/02/15/google-deepmind-proposes-new-framework-for-intelligent-ai-delegation-to-secure-the-emerging-agentic-web-for-future-economies/): Moves beyond brittle rule-based delegation. Emphasizes dynamic capability assessment, adaptive task reassignment, monitoring, reputation.
- [Zylos Research: Agent Delegation Patterns](https://zylos.ai/research/2026-03-08-ai-agent-delegation-team-coordination-patterns): "Delegation complexity floor" — for simple, low-risk tasks, delegation overhead exceeds task value. Direct execution is better.
- [Security Boulevard: Zero Trust for Multi-Agent](https://securityboulevard.com/2026/03/zero-trust-authorization-for-multi-agent-systems-when-ai-agents-call-other-ai-agents/): Zero trust principles for inter-agent comms. Delegation depth limits, cross-agent audit trails.
- [Tacnode: 8 Agent Coordination Patterns](https://tacnode.io/post/ai-agent-coordination): Hierarchical delegation outperforms flat coordination on complex tasks but introduces bottleneck risk.

**Key concepts from DeepMind framework**:

1. **Contract-First Decomposition**: A delegator only assigns a task if the outcome can be precisely verified. If too subjective → recursively decompose until sub-tasks match verification tools (unit tests, proofs).
2. **Permission Attenuation**: Sub-delegated tasks carry only minimum required permissions. Based on Delegation Capability Tokens (DCTs) using Macaroons/Biscuits cryptographic caveats.
3. **Dynamic Monitoring**: Parent agent can revoke authority mid-execution if sub-agent acts too slowly or hallucinates. Reassign to different node.
4. **Delegation Complexity Floor**: Don't delegate if the coordination overhead exceeds the task value.

**Applicability to EvoMesh**:

| DeepMind Concept | EvoMesh Equivalent | Gap |
|-----------------|-------------------|-----|
| Contract-first decomposition | Lead breaks tasks in todo.md | No verification criteria attached to tasks |
| Permission attenuation | None (trust-based) | Need PreToolUse hooks (recommended loop 2) |
| Dynamic monitoring | Reviewer role | Only reviews after-the-fact, not mid-execution |
| Delegation complexity floor | Implicit | Not formalized — lead sometimes routes trivial tasks |
| Reputation/trust scores | None | Could derive from metrics.log (recommended loop 3) |

**Concrete gap to close**: Tasks in todo.md should include **acceptance criteria** — how does the role (or reviewer) verify completion? Example:
```markdown
1. [ ] Implement role-card.json for research role
   - AC: file exists, valid JSON, contains name/capabilities/status fields
   - Verify: `jq . .evomesh/roles/research/role-card.json`
```

### 2. MetaGPT Architecture — Comparison with EvoMesh

- [MetaGPT Paper (ICLR 2024, arXiv:2308.00352)](https://arxiv.org/abs/2308.00352): "Code = SOP(Team)". Five roles: product manager, architect, project manager, engineer, QA. Assembly-line paradigm with structured outputs.
- [MetaGPT Docs](https://docs.deepwisdom.ai/main/en/guide/get_started/introduction.html): SOPs encoded as prompt sequences. Each agent generates structured output that prompts the next agent.
- [IBM Overview](https://www.ibm.com/think/topics/metagpt): Agents communicate through structured outputs based on assembly-line requirements.
- [MGX Launch (Feb 2025)](https://github.com/FoundationAgents/MetaGPT): MetaGPT X — "world's first AI agent development team" product.
- [AFlow (ICLR 2025)](https://openreview.net/forum?id=VtmBAGCN7o): Automating Agentic Workflow Generation. Oral presentation (top 1.8%). Auto-generates optimal agent workflows.

**Detailed comparison**:

| Dimension | MetaGPT | EvoMesh |
|-----------|---------|---------|
| Philosophy | Code = SOP(Team) | Roles = Autonomous + Coordinated |
| Roles | Fixed 5 (PM, Arch, PM, Eng, QA) | Configurable per project |
| Communication | Structured output → next agent | Inbox messages (markdown + YAML) |
| Workflow | Linear assembly line | Hub-spoke with async loops |
| SOP enforcement | Prompt sequences | ROLE.md + base-protocol.md |
| Persistence | In-memory (ephemeral) | Git-native files (permanent) |
| Human intervention | Minimal (fire-and-forget) | Human can read/write any file |
| Verification | QA role runs tests | Reviewer role audits code |
| Self-evolution | AFlow auto-generates workflows | Evolution.log + proposed self-evolution protocol |

**Key insight**: MetaGPT's **structured output requirement** is worth adopting. Currently, EvoMesh inbox messages have YAML frontmatter but free-form body. If bodies followed a per-message-type schema (e.g., `type: task` always includes `acceptance_criteria`, `estimated_effort`; `type: report` always includes `summary`, `findings`, `recommendations`), it would enable programmatic processing of messages.

**Self-critique**: MetaGPT's assembly-line model is more rigid but more predictable. EvoMesh's async loops are more flexible but harder to debug. The sweet spot is EvoMesh's model + MetaGPT's structured outputs. We don't need to change our topology, just formalize message schemas.

### 3. Context Compression for Long-Running Agents

- [Acon: Context Compression for LLM Agents (arXiv:2510.00615)](https://arxiv.org/html/2510.00615v2): Lowers memory usage by 26-54% while maintaining task performance. Enables distillation to smaller models preserving 95% accuracy.
- [COMPRESSION.md Specification](https://compression.md/): Open specification for AI agent context compression. Plain-text Markdown defining: when to compress, what to preserve, what to discard, how to verify. Part of 12-file agent safety spec.
- [LangChain: Context Management for Deep Agents](https://blog.langchain.com/context-management-for-deepagents/): Production strategies for context window management.
- [Anthropic Context Editing](https://platform.claude.com/docs/en/build-with-claude/context-windows): Combined context editing + memory tool achieved 84% token reduction in 100-turn dialogues (only 16% tokens used).
- [Factory.ai: Evaluating Context Compression](https://factory.ai/news/evaluating-compression): Framework for measuring compression quality.
- [LLMLingua (Microsoft Research)](https://medium.com/@kuldeep.paul08/prompt-compression-techniques-reducing-context-window-costs-while-improving-llm-performance-afec1e8f1003): Up to 20x compression with only 1.5% performance loss. 70-94% cost savings.
- [Getmaxim: Context Window Management](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/): "Context rot" — as token count grows, accuracy degrades. Curating what's in context matters as much as window size.

**Applicability to EvoMesh**:

EvoMesh roles are inherently resistant to context bloat because:
1. Each loop starts fresh (reads ROLE.md + todo + memory)
2. Short-term memory is cleared each loop (max 50 lines)
3. Long-term memory has a 200-line cap with archive trigger

However, within a single loop, context can grow if the role reads many files. The COMPRESSION.md specification is directly relevant:

**Recommended COMPRESSION.md for EvoMesh roles**:
```markdown
# preserve_always
- ROLE.md (full)
- Current todo.md
- Last inbox message being processed
- Active blockers

# compress_after (summarize, don't discard)
- Previous devlog entries (keep titles + recommendations only)
- Long-term memory entries older than 7 days

# discard_safe
- Completed todo items from more than 2 sprints ago
- Acknowledged inbox messages (already processed)
```

**Self-critique**: EvoMesh's loop-based architecture already handles most compression naturally. The main risk is long-term memory growing past 200 lines without triggering the archive. **Recommendation: automate the archive trigger** — add a check at loop start: if long-term.md > 200 lines, auto-archive oldest entries before proceeding.

### 4. OpenHands/Devin Architecture

- [OpenHands (arXiv:2407.16741)](https://arxiv.org/abs/2407.16741): Open platform for AI software developers as generalist agents. Write code, operate CLI, browse web, multi-agent delegation.
- [OpenHands GitHub (25k+ stars)](https://github.com/OpenHands/OpenHands): Raised $18.8M. Solves 87% of bug tickets same day. Hierarchical agent structures with delegation primitives.
- [MGX Analysis of OpenHands](https://mgx.dev/insights/a-comprehensive-analysis-of-opendevin-openhands-architecture-development-use-cases-and-challenges/62fee7b52567490da851f0ed7cb2bf9f): Comprehensive architecture breakdown.
- [OpenHands Official Site](https://openhands.dev/): AI-driven development platform. Cloud coding agents.

**Architecture highlights**:
- **Sandboxed execution**: Each agent runs in a Docker container with isolated filesystem
- **Hierarchical delegation**: Agents can spawn sub-agents with standardized vocabulary for roles/capabilities
- **Event-based communication**: Agents emit events (actions + observations) that are stored in an event stream
- **Browser integration**: Agents can navigate web UIs, not just CLI

**Comparison with EvoMesh**:

| Dimension | OpenHands | EvoMesh |
|-----------|-----------|---------|
| Isolation | Docker containers | Docker containers (same!) |
| Communication | Event stream (in-memory) | File-based inbox (git-native) |
| Delegation | Hierarchical sub-agents | Hub-spoke via lead |
| Persistence | Event log (ephemeral) | Git history (permanent) |
| Scope | Single coding task | Full project lifecycle |
| Multi-file | Yes (agent traverses codebase) | Yes (each role owns files) |
| Human visibility | Requires UI/tooling | Human-readable files |

**Key insight**: OpenHands' **event stream** is conceptually similar to EvoMesh's inbox system but ephemeral. EvoMesh's persistence via git is a significant advantage for auditability and reproducibility. However, OpenHands' event vocabulary (standardized action + observation types) could inspire structured event types for EvoMesh messages.

**Self-critique**: OpenHands is optimized for "solve this bug now" — single-task, high-intensity. EvoMesh is optimized for "run this project continuously" — multi-role, long-horizon. Different use cases, not competitors. However, OpenHands' sandboxing approach validates our Docker-per-role architecture.

---

## Analysis

### Cross-Cutting Theme: Structured Communication

Across all four topics, one theme emerges: **structured, verifiable communication** between agents is the key to reliability.

- DeepMind: Contract-first decomposition with verifiable outcomes
- MetaGPT: Structured output schemas per role
- COMPRESSION.md: Explicit rules for what to preserve vs. discard
- OpenHands: Standardized event vocabulary (action + observation types)

**EvoMesh's current state**: We have YAML frontmatter (structured metadata) but free-form message bodies. This is half-structured.

**Proposed improvement**: Define per-message-type body schemas:

```yaml
# type: task
body_schema:
  - description: string (required)
  - acceptance_criteria: string[] (required)
  - estimated_effort: enum [low, medium, high]
  - deadline: date (optional)

# type: report
body_schema:
  - summary: string (required)
  - findings: object[] (required)
  - recommendations: object[] (required)
  - next_steps: string[] (optional)

# type: feedback
body_schema:
  - target: string (role or commit ref)
  - severity: enum [P0, P1, P2]
  - issue: string (required)
  - suggested_fix: string (optional)
```

This enables: programmatic message validation, auto-routing based on content, metrics extraction from messages.

### Priority Matrix for This Batch

| Finding | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Task acceptance criteria in todo.md | High (verifiable completion) | Low (convention change) | **Do now** |
| Structured message body schemas | High (programmatic processing) | Medium (spec + validation) | **Next sprint** |
| Memory auto-archive trigger | Medium (prevents memory bloat) | Low (add check at loop start) | **Do now** |
| COMPRESSION.md per role | Low (loop arch already handles) | Low (one file) | **Nice to have** |
| Permission attenuation (DCTs) | High (security) | High (crypto infra) | **Defer** (hooks first) |

---

## Recommendations

1. **Add acceptance criteria to todo.md tasks** → lead + all roles: Based on DeepMind's contract-first decomposition. Every task gets an AC line specifying how completion is verified. Reviewer can check ACs instead of subjective assessment. Low effort, high impact.

2. **Define message body schemas per type** → agent-architect: Inspired by MetaGPT structured outputs + OpenHands event vocabulary. Spec goes in base-protocol.md. Each message type (task, report, feedback, ack) gets a required body structure. Enables future programmatic processing.

3. **Automate memory archive trigger** → agent-architect: Add to base-protocol loop flow: "if long-term.md > 200 lines, summarize oldest entries to archive.md before proceeding." Prevents context rot in long-running roles.

4. **Do NOT adopt MetaGPT's assembly-line topology** → lead: Our async hub-spoke model is more flexible and resilient. MetaGPT's linear pipeline is brittle (one role blocks all downstream). Take their structured outputs idea, not their topology.

5. **Do NOT build permission attenuation (DCTs) yet** → lead: DeepMind's Delegation Capability Tokens are the right long-term solution but require crypto infrastructure. PreToolUse hooks (already recommended) are the practical interim. Revisit DCTs if EvoMesh scales to multi-project/multi-org.

6. **Consider COMPRESSION.md as optional role config** → agent-architect: Not urgent (loop architecture already handles compression), but useful for roles that process many files per loop. Template in base-protocol.md, role-specific overrides optional.
