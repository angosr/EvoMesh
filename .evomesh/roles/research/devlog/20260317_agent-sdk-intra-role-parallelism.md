# Research Report — 2026-03-17: Agent SDK for Intra-Role Parallelism

## Task
Evaluate Anthropic Agent SDK (Python/TypeScript) for intra-role parallel subtask execution within EvoMesh loops.

## New Findings

### SDK Overview (current state)
- **Python**: `claude-agent-sdk` (pip), released Sept 2025, actively maintained
- **TypeScript**: `@anthropic-ai/claude-agent-sdk` (npm)
- Renamed from "Claude Code SDK" → "Claude Agent SDK" in early 2026
- [SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview): full docs
- [GitHub Python](https://github.com/anthropics/claude-agent-sdk-python) | [GitHub TypeScript](https://github.com/anthropics/claude-agent-sdk-typescript)

### Two Parallelism Mechanisms Available

**1. Subagents (SDK-native)**
- Spawn focused helper agents within a single `query()` call
- Each subagent gets its own context window
- Results return to parent agent only (no inter-agent messaging)
- Up to 10 simultaneous subagents
- Best for: focused tasks where only the result matters (e.g., "run tests + lint + type-check")
- [Subagents docs](https://code.claude.com/docs/en/sub-agents)

**2. Agent Teams (experimental, Claude Code v2.1.32+)**
- Multiple full Claude Code instances with shared task list + inter-agent messaging
- Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Higher token cost (each teammate = separate context window)
- Best for: complex work requiring discussion/coordination
- [Agent Teams docs](https://code.claude.com/docs/en/agent-teams)
- Overkill for intra-role parallelism

### Integration Pattern with Claude Code `/loop`

The Agent SDK `query()` function is callable from Python/TypeScript scripts. A role's loop iteration could:

```python
# Prototype: parallel lint + test + type-check
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def run_parallel_checks():
    tasks = [
        query(prompt="Run npm run lint and report results",
              options=ClaudeAgentOptions(allowed_tools=["Bash"])),
        query(prompt="Run npm test and report results",
              options=ClaudeAgentOptions(allowed_tools=["Bash"])),
        query(prompt="Run npx tsc --noEmit and report results",
              options=ClaudeAgentOptions(allowed_tools=["Bash"])),
    ]
    # Each query() is independent — run all 3 in parallel
    results = await asyncio.gather(*[consume(t) for t in tasks])
    return results
```

**However**, this requires:
- An ANTHROPIC_API_KEY (separate from the Claude Code session key)
- Each `query()` = separate API billing (3 parallel queries = 3x input token cost minimum)
- The calling role is *already* a Claude Code session — spawning SDK agents from within Claude Code is redundant

### Token/Cost Overhead

| Component | Overhead |
|-----------|----------|
| Tool system prompt | ~346 tokens per request (Sonnet) |
| Per tool definition | ~150 tokens each |
| 5 tools × 3 parallel agents | ~2,250 extra input tokens |
| Context window per subagent | Full separate context (no sharing with parent) |
| Cache tokens | SDK uses prompt caching automatically — repeat calls cheaper |

**Key cost insight**: Each subagent/parallel query is a full API round-trip with its own context window. For simple commands like "run lint", the orchestration token overhead far exceeds the actual work.

### EvoMesh-Specific Analysis

**Current EvoMesh architecture**: Each role runs as a Claude Code session via `/loop`. Claude Code already supports:
- **Built-in parallel tool calls**: Claude can call multiple Bash commands in a single response turn (no SDK needed)
- **Built-in subagents**: The `Agent` tool in Claude Code spawns subagents natively
- **Git worktree isolation**: `isolation: "worktree"` for safe parallel file operations

**The core question**: Can a role use Agent SDK to run parallel subtasks within a single loop?

**Answer**: Yes, technically possible but **architecturally redundant**. Claude Code sessions already have subagent capabilities via the native `Agent` tool. Adding Agent SDK on top would be:
1. Running Claude from within Claude (unnecessary nesting)
2. Requiring a separate API key and billing pipeline
3. Adding token overhead without proportional benefit
4. Creating debugging complexity (nested agent errors)

### What Actually Works for core-dev Parallelism

core-dev can already parallelize "run tests + lint + type-check" **today** using:

```
# Native Claude Code — no SDK needed
# Just call multiple Bash tools in a single response:
Bash("npm run lint") + Bash("npm test") + Bash("npx tsc --noEmit")
# All three run in parallel within the same response turn
```

Or with subagents for heavier tasks:
```
Agent(prompt="Run full test suite and analyze failures", subagent_type="general-purpose")
Agent(prompt="Run linter and fix auto-fixable issues", subagent_type="general-purpose")
# Both run in parallel, results return to parent
```

## Analysis

The Agent SDK is designed for **external applications** that want Claude Code capabilities programmatically — CI/CD pipelines, custom tools, production automation. It's not designed for use *within* Claude Code sessions, which already have all the same capabilities natively.

For EvoMesh's use case (roles running as Claude Code sessions), the SDK adds a layer of indirection without new capability. The native `Agent` tool and parallel `Bash` calls already solve the parallelism problem.

**Where Agent SDK *would* be valuable for EvoMesh**:
- If we build a **non-Claude-Code orchestrator** (e.g., a TypeScript Express route that spawns role agents)
- For **CI/CD integration** (GitHub Actions running Agent SDK to validate PRs)
- For **external tooling** that needs to interact with EvoMesh programmatically

## Recommendations

### 1. **DEFER** Agent SDK for intra-role parallelism
- Current Claude Code native capabilities (parallel Bash, Agent tool) already solve this
- No benefit to running Agent SDK from within Claude Code sessions
- Revisit if EvoMesh moves to a custom orchestrator architecture

### 2. **ADOPT (future)** Agent SDK for CI/CD and external integration
- When EvoMesh adds CI/CD workflows, Agent SDK is the right tool
- E.g., GitHub Action that runs `query("Review this PR for security issues")`
- Track: add to P2 monitoring for when CI/CD phase begins

### 3. **IMMEDIATE** — Document native parallelism patterns for core-dev
- core-dev should use parallel Bash calls for lint/test/type-check today
- No new tooling needed — just prompt engineering in ROLE.md
- Suggest adding to core-dev ROLE.md: "Use parallel Bash calls for independent commands"

## Self-Attack

- *"But what if roles need heavier parallelism?"* → Agent Teams (experimental) already exists for that. Still no need for SDK-within-Claude-Code.
- *"What about token efficiency?"* → Running SDK from Claude Code is strictly *less* efficient (double context windows). Native parallel calls share the session context.
- *"Is there a persistence benefit?"* → SDK supports sessions (resume by ID), but Claude Code already has session persistence. No gain.
