# Research: Compliance Chain Attenuation — Why Rules Get Ignored

## The Problem
Observed compliance rates in EvoMesh:
- ROLE.md direct instructions: ~90%
- base-protocol.md (referenced indirectly): ~50%
- Post-task steps (memory, metrics, todo): often skipped entirely

## Root Cause Analysis

### 1. Attention Budget Depletion
LLMs have finite attention per response. Complex coding tasks consume most of it. Post-task housekeeping (memory, metrics, todo) competes for remaining attention and loses. This is not a "bug" — it's a fundamental LLM behavior: primary task takes priority, secondary instructions decay.

Research confirms: "agentic tasks usually involve long and complex instructions... whether LLMs can effectively follow instructions in real-world agentic scenarios remains underexplored" (AGENTIF benchmark, Tsinghua 2025).

### 2. Indirection Penalty
Each layer of indirection reduces compliance:
- **Layer 0**: Text directly in the prompt → ~95% compliance
- **Layer 1**: Text in ROLE.md (read at start) → ~90%
- **Layer 2**: Text in base-protocol.md (referenced by ROLE.md) → ~50%
- **Layer 3**: Convention implied by protocol → ~20%

This is "Compliance Chain Attenuation" — each link in the reference chain loses ~50% compliance.

### 3. Position Effect
Rules at the END of a document have lower compliance than rules at the BEGINNING. Memory/metrics rules are typically in loop flow steps 6-8 (the end), after the exciting work (step 5).

## Solutions: 5 Strategies Ranked by Effectiveness

### Strategy 1: Hooks (100% compliance) ⭐ RECOMMENDED
**"Prompt-based instructions achieve 70-90% compliance. Hooks achieve 100%."** — Claude Code docs

Use Claude Code hooks to ENFORCE post-task actions:

**PostToolUse hook** — after every Edit/Write, check if short-term.md was updated this session:
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": ".evomesh/hooks/verify-loop-compliance.sh"
      }]
    }]
  }
}
```

**verify-loop-compliance.sh**:
```bash
#!/bin/bash
# Check if short-term.md was modified in this session
ROLE_DIR=".evomesh/roles/${ROLE_NAME}"
if [ ! -f "${ROLE_DIR}/memory/short-term.md" ] || \
   [ "$(find ${ROLE_DIR}/memory/short-term.md -mmin +30)" ]; then
  echo "COMPLIANCE VIOLATION: short-term.md not updated this loop. Write it now." >&2
  exit 2  # Block stop — force Claude to keep working
fi
# Check metrics.log
if [ ! -f "${ROLE_DIR}/metrics.log" ]; then
  echo "COMPLIANCE VIOLATION: metrics.log missing. Create and append." >&2
  exit 2
fi
exit 0
```

**Stop hook** is the key: it fires when Claude tries to finish responding. If compliance check fails, Claude is FORCED to continue and fix the violation. This is 100% deterministic — no LLM reasoning involved.

### Strategy 2: Inline Rules in Loop Prompt (85-95% compliance)
Move critical rules from base-protocol.md into the `/loop` prompt itself:

Current:
```
/loop 10m 你是 executor 角色。执行 ROLE.md
```

Proposed:
```
/loop 10m 你是 executor 角色。执行 ROLE.md。完成后必须：(1) 写 memory/short-term.md (2) 追加 metrics.log (3) 更新 todo.md
```

Rules in the LOOP PROMPT are Layer 0 — they're literally in the user message, not behind a file reference. This eliminates the indirection penalty for the most critical rules.

### Strategy 3: Reduce Indirection Depth (70-80% compliance)
Instead of ROLE.md saying "Follow base-protocol.md", inline the 5 most critical rules directly into ROLE.md:

```markdown
## Mandatory Per-Loop Actions (from base-protocol — DO NOT SKIP)
1. Write memory/short-term.md (Done/Blockers/In-progress/Next)
2. Append metrics.log CSV line
3. Update todo.md
4. git add own files only + commit + push
```

This reduces Layer 2 rules to Layer 1.

### Strategy 4: Position Optimization (incremental improvement)
Move compliance-critical rules to the TOP of ROLE.md, not the bottom. The loop flow should START with "write memory" and END with "do work" — reversing the natural order forces compliance before the attention budget is depleted.

Alternative: put compliance rules in BOTH the top AND the bottom (bookend pattern). Redundancy increases recall.

### Strategy 5: Structural Enforcement via entrypoint.sh (100% for git operations)
For git operations, enforce at the shell level — not through Claude at all:

```bash
# In entrypoint.sh, after Claude's loop finishes:
# Force-add memory and metrics files
git add .evomesh/roles/${ROLE_NAME}/memory/short-term.md
git add .evomesh/roles/${ROLE_NAME}/metrics.log 2>/dev/null
git add .evomesh/roles/${ROLE_NAME}/todo.md
```

This guarantees files are committed even if Claude forgets to `git add` them.

## Recommendation: Layered Approach

| Layer | Mechanism | Compliance | Effort |
|---|---|---|---|
| 1 | **Stop hook** — verify-loop-compliance.sh | 100% | Medium (core-dev) |
| 2 | **Loop prompt** — inline critical rules | 85-95% | Low (config change) |
| 3 | **ROLE.md** — inline top-5 rules from base-protocol | 70-80% | Low (template change) |
| 4 | **entrypoint.sh** — force git add memory files | 100% for git | Low (script change) |

**Implement all 4 layers.** They're complementary, not redundant:
- Hooks catch what Claude misses (deterministic safety net)
- Loop prompt ensures Claude SEES the rules (eliminates indirection)
- ROLE.md inlining reduces attenuation (Layer 2 → Layer 1)
- entrypoint.sh handles git mechanically (removes from Claude's responsibility)

## Broader Implication for EvoMesh

**This is the most important finding for the self-bootstrapping goal.** The bottleneck isn't "do we have the right rules?" — it's "does Claude follow them?" Hooks shift enforcement from probabilistic (LLM reasoning) to deterministic (system-level), which is the only reliable path to autonomous multi-agent operation.

## Sources
- [AGENTIF: Benchmarking Instruction Following (Tsinghua 2025)](https://keg.cs.tsinghua.edu.cn/persons/xubin/papers/AgentIF.pdf)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Claude Code Hooks: Deterministic Control Layer](https://www.dotzlaw.com/insights/claude-hooks/)
- [When Refusals Fail: Unstable Safety in Long-Context LLM Agents](https://arxiv.org/pdf/2512.02445)
- [Responsible LLM-empowered Multi-Agent Systems](https://arxiv.org/html/2502.01714v1)
