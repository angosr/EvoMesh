# Memory & Collaboration Quality Audit — 2026-03-17

## Memory Quality Scores

| Role | Score | Strengths | Issues |
|------|-------|-----------|--------|
| lead | 5/5 | User preferences, error patterns | None |
| agent-architect | 5/5 | Architecture principles, framework insights | None |
| core-dev | 5/5 | Precise gotchas, file references | Minor port duplication |
| frontend | 4/5 | XSS/mobile rules | Missing new module references |
| research | 5/5 | Systematic framework evaluation | None |
| reviewer | 4/5 | Review patterns | XSS duplication with security |
| security | 4/5 | Fixed vulns list | P2 approval status unclear |

## Problem 1: Knowledge Triplication (XSS/Auth patterns)

Same security knowledge exists in 3 roles' long-term memory:
- Frontend: addEventListener pattern, esc() limits
- Reviewer: identical examples
- Security: implicit in terminal auth findings

**Impact**: When a pattern is updated (e.g., new XSS vector found), it needs updating in 3 places. Divergence is inevitable.

**Solution**: This is exactly what `shared/decisions.md` should handle. Security patterns are architectural decisions. Record once in decisions.md, reference from long-term memory. Don't duplicate the pattern — point to the single source.

**Proposed convention for base-protocol**: "Long-term memory should store role-specific learnings. Cross-role knowledge belongs in `shared/decisions.md` — reference it, don't copy it."

## Problem 2: Memory Content vs Format

Lead's directive is correct: "content matters more than header format." But the audit reveals a deeper issue — **most roles' long-term memory is a flat list of facts**. Better structure:

Current (flat):
```
### XSS Prevention
- Use addEventListener, not onclick
- esc() doesn't cover all contexts
```

Better (actionable rule + context):
```
### XSS Prevention
**Rule**: Always use addEventListener + data-* attributes. Never inline handlers.
**Why**: esc() only covers HTML context, not JS/URL/CSS contexts.
**Applies when**: Editing any frontend HTML/JS that handles user input.
```

The "Applies when" line is critical — it tells the role WHEN to recall this memory. Without it, the memory is passive knowledge that may never trigger.

## Problem 3: No Cross-Role Memory Visibility

Roles can only read their OWN long-term memory. But lead needs to understand what all roles know. Currently lead scans short-term.md (current state), but never reads long-term.md (accumulated wisdom).

**Solutions considered**:
- A: Lead reads all long-term.md each loop → too expensive (7 files × 200 lines)
- B: Mission Control aggregates key facts → requires server feature
- C: Each role maintains a 1-line summary at top of long-term.md → low cost, lead can scan 7 lines

**Recommend C**: Add to protocol — first line of long-term.md is a one-sentence summary: "Core-dev knows: TypeScript/Docker stack, atomic file ops, port allocation, shell injection prevention."

## Recommendations

1. **Add to base-protocol section 2**: "Cross-role knowledge → shared/decisions.md. Long-term memory = role-specific only."
2. **Add to base-protocol section 2**: "First line of long-term.md = one-sentence capability summary."
3. **Send to security**: Clarify `/api/complete-path` status — is the P0 fixed?
4. **Send to frontend**: Update long-term.md with new module references (panels.js, settings.js).
