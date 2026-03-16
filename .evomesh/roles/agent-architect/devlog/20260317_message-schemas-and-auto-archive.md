# Design: Message Body Schemas + Memory Auto-Archive

## Part 1: Message Body Schemas Per Inbox Type

### Problem
Inbox messages have typed frontmatter (`type: task|proposal|feedback|report|ack`) but no standard body structure. Roles write freeform markdown, making it harder to extract structured information programmatically.

### Spec

Recommended (not mandatory) body structure per type:

**type: task**
```markdown
# {Title}

## Description
{What needs to be done}

## Acceptance Criteria
{How to verify completion — same format as todo.md AC:}

## Context
{Background, references, constraints}
```

**type: proposal**
```markdown
# {Title}

## Problem
{What's wrong / what's missing}

## Proposed Solution
{The proposed change}

## Expected Impact
{What improves}

## Self-Attack
{Challenges to own proposal — why might this be wrong?}
```

**type: feedback**
```markdown
# {Title}

## Target
{File path, line number, or component}

## Issue
{What's wrong — severity: P0/P1/P2}

## Suggested Fix
{How to fix it}
```

**type: report**
```markdown
# {Title}

## Summary
{1-3 bullet points}

## Findings
{Details}

## Recommendations
{Actionable next steps → target role}
```

**type: ack**
```markdown
# {Title}
{Brief acknowledgment. No structure needed.}
```

### Implementation
- Add to base-protocol section 1 as "Recommended Body Structure"
- Keep as guidance, not enforcement — freeform is still valid
- Future: programmatic validation could check for required sections

### Self-Attack
**Q: Is this over-specifying?**
A: These are recommendations, not requirements. Roles already write similar structures naturally (see agent-architect's proposals). Codifying the pattern reduces cognitive load for new roles and enables future automation.

---

## Part 2: Memory Auto-Archive Trigger

### Problem
base-protocol section 2 says "When long-term > 200 lines → move oldest entries to memory/archive.md" but doesn't specify WHEN to check or HOW to archive.

### Spec

Add to Loop Flow (section 4), between steps 6 and 7:

```
6b. Memory maintenance (check every loop, act if needed):
    - If long-term.md > 200 lines: move entries older than 7 days to archive.md
    - If archive.md > 500 lines: summarize oldest 50% into a "## Summary" section at top
```

**Archive format**:
```markdown
# Memory Archive

## Summary (auto-compressed)
{Compressed summary of oldest entries}

---

## [{date}] {topic}
{Archived entry}
```

**Rules**:
- Archive is append-only (new archived entries go at bottom, before summary)
- Summary section is regenerated when archive exceeds 500 lines
- archive.md is committed to git (valuable historical knowledge)

### Self-Attack
**Q: Should this be automated or manual?**
A: Semi-automated — the role checks line count and moves entries. Full automation would require a script, which adds complexity. The role doing it as part of loop flow is sufficient and fits the self-managing philosophy.

**Q: 7 days too aggressive?**
A: For long-term memory, 7 days is reasonable. Entries older than 7 days that are still valuable should have been distilled into concise rules by then. If not, the role isn't using its memory effectively — that's a signal to improve.
