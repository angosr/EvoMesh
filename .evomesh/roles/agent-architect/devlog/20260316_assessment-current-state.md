# Assessment Report — 2026-03-16

## Scope
P0 task: Assess current multi-agent collaboration architecture across all 7 roles.

## Findings

### 1. base-protocol.md is Missing
Every ROLE.md references `~/.evomesh/templates/base-protocol.md` as foundational, but the file does not exist at that path. Status.md mentions "base-protocol.md created, code templates still in use as fallback" — but the file is absent from the filesystem. This is a **critical gap**: roles have no shared protocol definition for inbox format, memory lifecycle, commit conventions, or conflict resolution.

### 2. Inbox Format — Strengths and Weaknesses
**Current format** (from lead's processed inbox):
```yaml
---
from: user
priority: critical
type: task
---
# Title
## Content
```

**Strengths:**
- YAML frontmatter is parseable, git-diffable, human-readable
- Priority levels exist (critical/P0/P1/P2)
- Type field allows categorization

**Weaknesses:**
- No `to:` field — messages land in a role's inbox/ dir, but multi-recipient or broadcast messages require duplication
- No `date:` field in frontmatter — date is encoded in filename only, making programmatic sorting harder
- No `status:` field — processed messages go to `processed/` subdir, but there's no ack/reject/pending state
- No `thread-id:` — related messages (proposal → approval → implementation) can't be linked
- Filename convention inconsistent: `20260316_0830_user_topic.md` vs `20260316T1600_executor_topic.md` (underscore vs T separator)

### 3. Memory System — Largely Unused
Every role has `memory/short-term.md` and `memory/long-term.md`. All are empty. The split is conceptually sound (working memory vs persistent knowledge) but:
- No defined lifecycle: when does short-term become long-term? When is short-term cleared?
- No structure within the files — flat markdown with no indexing
- No size limits — long-term memory could grow unbounded
- No retrieval mechanism — roles must read the entire file every loop

### 4. Role Design — Generally Well-Structured
- Clear separation of concerns across 7 roles
- "Propose, don't implement" pattern for reviewer/security/agent-architect is good
- Lead as single coordinator prevents conflicting changes
- Loop flow is consistent across roles (pull → read → work → commit → push)

### 5. Communication Topology
Current design is **hub-and-spoke** (everything through lead). This is safe but creates bottlenecks:
- Security finding → lead → core-dev = 2 loop delays minimum (40-60 min for a P0 fix)
- No direct channel for urgent cross-role coordination
- Lead becomes a single point of failure

### 6. Shared Documents
- `blueprint.md` and `status.md` are well-maintained by lead
- `shared/decisions.md` exists and is used (good)
- `shared/blockers.md` exists but not checked
- No shared glossary or convention doc

## Overall Assessment

The collaboration architecture is **functional but fragile**. The biggest risks are:
1. Missing base-protocol.md leaves roles without shared rules
2. Empty memory means no learning across loops
3. Hub-and-spoke topology creates latency for urgent issues
4. Inbox format lacks threading and timestamps in frontmatter
