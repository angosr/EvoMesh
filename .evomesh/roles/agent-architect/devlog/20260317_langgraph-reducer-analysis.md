# Research: LangGraph Reducer Pattern — Applicability to EvoMesh

## LangGraph's Approach

LangGraph manages multi-agent shared state via **typed state schemas with reducer functions**:

```python
from typing import Annotated
from operator import add

class SharedState(TypedDict):
    messages: Annotated[list, add]        # append reducer
    decisions: Annotated[list, add]       # append reducer
    status: str                           # last-write-wins (default)
```

Key concepts:
1. **Reducers per field**: Each state field has a merge strategy (append, last-write-wins, custom)
2. **Super-steps**: Concurrent nodes execute in batches; all must complete before next step
3. **Atomic merges**: Updates from concurrent nodes merged via reducers after super-step completes
4. **Checkpointing**: State persisted after each super-step for resume/audit

## Mapping to EvoMesh

| LangGraph Concept | EvoMesh Equivalent | Gap |
|---|---|---|
| State schema | project.yaml + shared/ files | No typed schema — freeform markdown |
| Reducer (append) | Append-only convention (decisions.md) | ✅ Already designed — section 10 |
| Reducer (last-write-wins) | status.md, blueprint.md (lead-only) | ✅ Single-writer = no conflicts |
| Super-step | Loop cycle (all roles execute, then git sync) | Approximate — git pull/push is the sync point |
| Checkpoint | Git commits | ✅ Every commit is a checkpoint |
| Concurrent merge | Git merge on pull --rebase | Works for append-only; risky for edits |

## Analysis: What EvoMesh Already Has

Our file-based architecture **already implements the reducer pattern** implicitly:

1. **Append-only files** (decisions.md, blockers.md, metrics.log) = **append reducer** — git merges these cleanly
2. **Single-writer files** (blueprint.md by lead, ROLE.md by owner) = **last-write-wins reducer** — no concurrency risk
3. **Per-role files** (todo.md, short-term.md, heartbeat.json) = **partitioned state** — no conflicts by design
4. **Git commits** = **checkpoints** — full state history, resumable

## Where LangGraph Adds Value (Gaps We Should Consider)

### Gap 1: No Typed State Schema
LangGraph enforces field types and reducer rules at compile time. EvoMesh relies on convention (base-protocol.md). Violation detection is manual (reviewer role).

**Recommendation**: role-card.json is a step in this direction. Consider a `state-schema.json` that formally declares which files use which merge strategy. Low priority — convention is working.

### Gap 2: No Atomic Super-Steps
LangGraph ensures all concurrent agents complete before state merges. EvoMesh roles commit asynchronously — role A may push while role B is mid-loop, causing role B's next pull to see partial state.

**Recommendation**: This is inherent to file+git architecture. Mitigation: the rebase-on-push pattern (base-protocol section 4 step 8) handles this. For truly atomic operations, roles should coordinate via inbox (one role completes before next starts). Not a practical problem at current scale.

### Gap 3: No Conflict Resolution Reducer
When two roles edit the same non-append-only file, git may conflict. LangGraph's reducer handles this programmatically.

**Recommendation**: Already mitigated by:
- Scope enforcement (hooks design) — roles can't write same files
- Single-writer convention for shared docs
- Append-only for multi-writer docs
- Manual conflict resolution protocol (base-protocol section 5)

## Conclusion

**EvoMesh's file-based architecture is a natural implementation of the reducer pattern.** The key insight from LangGraph is that our existing conventions (append-only, single-writer, partitioned state) ARE reducers — we just don't call them that.

No architectural changes needed. The LangGraph comparison validates our design choices:
- Append-only shared docs ✅ (equivalent to append reducer)
- Single-writer strategic docs ✅ (equivalent to last-write-wins)
- Per-role state files ✅ (equivalent to partitioned state)
- Git commits ✅ (equivalent to checkpoints)

## Sources
- [LangGraph State Management Best Practices (Medium 2025)](https://medium.com/@bharatraj1918/langgraph-state-management-part-1-how-langgraph-manages-state-for-multi-agent-workflows-da64d352c43b)
- [Reducers Demonstrated (Medium)](https://medium.com/@mor.hananovitz/agents-101-reducers-demonstrated-f2c480162641)
- [Scaling LangGraph: Parallelization and Map-Reduce](https://aipractitioner.substack.com/p/scaling-langgraph-agents-parallelization)
- [Architecture of Agent Memory: How LangGraph Works (DEV)](https://dev.to/sreeni5018/the-architecture-of-agent-memory-how-langgraph-really-works-59ne)
