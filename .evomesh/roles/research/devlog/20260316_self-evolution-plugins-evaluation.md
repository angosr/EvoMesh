# Research Report — 2026-03-16 (Loop 3)

## Topic: Self-Evolution Mechanisms, Plugin Packaging, WMAC 2026, Agent Evaluation

---

## New Findings

### 1. Self-Evolution Mechanisms for AI Agents

- [OpenAI Self-Evolving Agents Cookbook](https://developers.openai.com/cookbook/examples/partners/self_evolving_agents/autonomous_agent_retraining/): Practical guide. Uses eval-driven loops: agent runs → evaluates output → reflects → revises prompt → iterates. The GEPA (Genetic-Pareto) framework uses evolutionary algorithms on prompt populations.
- [EvoMAC (ICLR 2025)](https://openreview.net/forum?id=4R71pdPBZp): Self-Evolving Multi-Agent Collaboration Networks. Textual backpropagation: output verified against target → feedback propagated back to update agent prompts. Outperforms SOTA by 26-35% on software benchmarks. [GitHub](https://github.com/EvoAgentX/Awesome-Self-Evolving-Agents)
- [aiXplain Evolver](https://aixplain.com/blog/evolver-meta-agent-self-improving-ai/): Meta-agent that optimizes other agents' prompts, tools, and configurations. Commercial implementation of self-evolution.
- [Comprehensive Survey of Self-Evolving Agents](https://github.com/EvoAgentX/Awesome-Self-Evolving-Agents): Curated paper list. Self-evolution via: meta-learning, evolutionary optimization, hierarchical memory, recursive self-modification, RL on episodic memory.
- [SICA: Self-Improving Coding Agent](https://www.emergentmind.com/topics/self-evolving-software-engineering-agents): Agent autonomously edits its own codebase to improve benchmark performance.
- [Meta-Prompting (IntuitionLabs)](https://intuitionlabs.ai/articles/meta-prompting-llm-self-optimization): LLMs craft and enhance their own prompts. APE method: generate candidate prompts → score on validation → select best.

**Applicability to EvoMesh**:

EvoMesh already has `evolution.log` per role, but it's passive — just a log, not an active mechanism. Based on the research, here's a concrete self-evolution design:

```
Self-Evolution Loop (per role, every N loops):
1. Collect metrics from last N loops (commits, inbox messages, todo completion rate)
2. LLM reflects: "What went well? What was slow/wrong?"
3. Generate candidate ROLE.md modifications (prompt changes)
4. Evaluate: run a "dry loop" with modified ROLE.md against recent task history
5. If improvement detected → propose change to lead via inbox
6. Lead approves → ROLE.md updated
```

**Self-critique**: Full SICA-style self-modification (agent edits own codebase) is too risky for EvoMesh — a role could break its own constraints. The **eval-then-propose** pattern (EvoMAC style) is safer: the role proposes changes, lead approves. This aligns with our hub-spoke governance model.

**Key insight from EvoMAC**: "Textual backpropagation" — propagating feedback as natural language through the agent network — is directly analogous to EvoMesh's inbox system. Feedback from reviewer → lead → role is already textual backprop. We just need to close the loop by having roles act on feedback to modify their own instructions.

### 2. Claude Code Plugin Packaging

- [Claude Code Plugin Docs](https://code.claude.com/docs/en/plugins): Official documentation. Plugin = directory with `.claude-plugin/plugin.json` manifest. Bundles slash commands, subagents, MCP servers, hooks.
- [Plugin Marketplace (Anthropic)](https://www.anthropic.com/news/claude-code-plugins): Plugins in public beta. Install via `/plugin` command. Works in terminal and VS Code.
- [Build With Claude Marketplace](https://buildwithclaude.com/): Community marketplace for plugins.
- [claude-plugins.dev](https://claude-plugins.dev/): Community registry with CLI.
- [Plugin creation guide (DevelopersIO)](https://dev.classmethod.jp/en/articles/claude-code-skills-subagent-plugin-guide/): Step-by-step: create skills + subagents, package as plugin, distribute via marketplace.
- [Marketplace hosting](https://deepwiki.com/shanraisshan/claude-code-best-practice/7.3-plugins-and-marketplaces): Host marketplace with just a git repo + `marketplace.json`. Install with `/plugin marketplace add user-or-org/repo-name`.
- [Claude Code Templates (GitHub)](https://github.com/davila7/claude-code-templates): CLI tool for configuring and monitoring Claude Code projects.

**Applicability to EvoMesh**:

Each EvoMesh role could be packaged as a Claude Code plugin:
```
.claude-plugin/
  plugin.json          # manifest: name, version, description
  skills/
    research-loop.md   # the role's loop flow as a skill
  agents/
    research.md        # subagent definition (YAML frontmatter + instructions)
  hooks/
    scope-guard.sh     # PreToolUse hook for write scope enforcement
  mcp/
    config.json        # role-specific MCP server configs
```

**Distribution model**: EvoMesh itself could be a marketplace (`marketplace.json` in the repo). Users install roles they need: `/plugin marketplace add evomesh/roles`, then pick `research`, `reviewer`, `frontend`, etc.

**Self-critique**: Plugin packaging is appealing but premature. Our role definitions are still evolving rapidly. Packaging creates versioning overhead. **Recommendation: design the plugin structure now (document it), but don't actually package until role definitions stabilize (estimate: after 3-4 more sprint cycles).**

### 3. AAAI 2026 WMAC Workshop

- [WMAC 2026 Overview](https://multiagents.org/2026/): AAAI 2026 Bridge Program, Jan 20, 2026, Singapore. One-day program: invited talks, panel discussion, demos, oral/poster presentations. Best paper election.
- ["Agentifying Agentic AI" (arXiv:2511.17332)](https://arxiv.org/html/2511.17332): Key WMAC paper by Virginia & Frank Dignum (Umeå University). Argues current agentic AI lacks explicit models of cognition, cooperation, and governance. Highlights risk: agents acting on unwanted results from other agents, users notice many steps later.
- [WMAC 2025 Agenda](https://multiagents.org/2025-agenda/): Previous year's agenda gives insight into research directions.

**Key themes from WMAC 2026**:
1. **Governance of multi-agent systems** — who controls what agents can do? (Directly relevant to EvoMesh's lead-approval model)
2. **Social norms for agents** — how do agents establish shared behavioral expectations? (Maps to our base-protocol.md)
3. **Evaluation & benchmarks** — standardized assessment of multi-agent collaboration
4. **Risk of cascading errors** — one agent's mistake propagates through the system

**Applicability to EvoMesh**: The "Agentifying Agentic AI" paper validates our hub-spoke governance model (lead approves cross-role changes). Their concern about cascading errors is exactly why our reviewer role exists — it catches problems before they propagate. However, we should add **circuit breakers**: if a role produces N consecutive errors, it should auto-pause and alert lead.

### 4. Agent Evaluation Frameworks

- [Amazon Agent Evaluation (AWS Blog)](https://aws.amazon.com/blogs/machine-learning/evaluating-ai-agents-real-world-lessons-from-building-agentic-systems-at-amazon/): Two components: generic evaluation workflow + agent evaluation library. Measures tool selection accuracy, multi-step reasoning coherence, task completion.
- [Agent Evaluation Framework 2026 (Galileo)](https://galileo.ai/blog/agent-evaluation-framework-metrics-rubrics-benchmarks): Comprehensive metrics taxonomy: behavior, capabilities, reliability, safety.
- [Top Evaluation Tools (Dr. Olson)](https://www.randalolson.com/2026/03/06/top-tools-to-evaluate-and-benchmark-ai-agent-performance-2026/): LangSmith, Weave, DeepEval for production monitoring.
- [10 AI Agent Benchmarks (Evidently)](https://www.evidentlyai.com/blog/ai-agent-benchmarks): GAIA, SWE-bench, WebArena, etc.
- [IBM Agent Benchmarks (IBM Research)](https://research.ibm.com/blog/AI-agent-benchmarks): Focus on future of evaluation — efficiency, robustness, generalization metrics.
- [Evaluation Survey (arXiv:2507.21504)](https://arxiv.org/html/2507.21504v1): Comprehensive survey organizing by evaluation objectives and process.

**EvoMesh-specific evaluation metrics** (proposed):

| Metric | What it measures | How to compute |
|--------|-----------------|----------------|
| Loop completion rate | % of loops that complete without errors | Parse commit history per role |
| Todo throughput | Tasks completed per unit time | Diff todo.md across commits |
| Inbox response time | How fast roles respond to P0/P1 messages | Timestamp delta between message and ack |
| Merge conflict rate | How often git merge fails | Count merge conflict markers in history |
| Reviewer catch rate | Issues found by reviewer per loop | Count findings in reviewer devlog |
| Self-evolution rate | ROLE.md changes proposed and accepted | Track role-card.json changes over time |

**Self-critique**: Building a full evaluation framework is premature. But **logging the raw data now** (loop start/end timestamps, task counts, error counts) costs almost nothing and enables future evaluation. **Recommendation: add a `metrics.log` append-only file per role.** Each loop appends one line: `{timestamp},{loop_duration_s},{tasks_completed},{errors},{inbox_messages_sent}`.

---

## Analysis

### The Self-Evolution Opportunity

EvoMesh is uniquely positioned for self-evolution because:
1. **Everything is text** — ROLE.md, todo.md, memory are all LLM-readable/writable
2. **Git provides rollback** — if a self-modification fails, we can revert
3. **Hub-spoke governance** — lead approval prevents runaway self-modification
4. **Reviewer as safety net** — catches problematic changes before they propagate

The EvoMAC "textual backpropagation" concept maps perfectly: reviewer feedback → lead decision → role update is already a feedback loop. We just need to formalize it as a self-evolution protocol.

### Plugin Strategy

The Claude Code plugin system is the right long-term distribution mechanism for EvoMesh roles. But the current priority is getting roles working well, not packaging them. **Design the plugin structure in a spec doc now, implement packaging later.**

---

## Recommendations

1. **Design self-evolution protocol** → agent-architect: Formalize how roles propose ROLE.md changes based on performance feedback. Pattern: collect metrics → reflect → propose → lead approves → update. Based on EvoMAC's textual backpropagation.

2. **Add metrics.log per role** → agent-architect: Append-only, one line per loop. Fields: timestamp, duration, tasks_completed, errors, inbox_sent. Near-zero cost, enables future evaluation. This is the "instrument now, analyze later" pattern.

3. **Add circuit breaker mechanism** → agent-architect: If a role produces N consecutive errors (failed commits, empty loops), auto-pause and send P0 alert to lead. Prevents cascading failures per WMAC 2026 research.

4. **Write plugin structure spec** → agent-architect: Document how EvoMesh roles will map to Claude Code plugins (.claude-plugin/ structure). Don't implement yet — just the spec for when roles stabilize.

5. **Do NOT package roles as plugins yet** → lead: Role definitions are still evolving. Packaging creates versioning overhead that slows iteration. Revisit after 3-4 sprint cycles when roles are stable.

6. **Track WMAC 2026 accepted papers** → research (self): Full paper list not yet available on multiagents.org. Check back in next monitoring cycle for additional papers beyond "Agentifying Agentic AI".
