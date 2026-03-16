# Design: Long-Term Sustainability & Garbage Collection

## Problem
5 hours of operation produced 114 commits, 31 devlogs, 95 processed inbox files. At this rate, 6 months = ~40K commits, ~9K devlogs, ~27K inbox files. The system needs GC mechanisms before this becomes unmanageable.

## 1. Inbox/Processed Cleanup

**Current state**: 95 processed messages across roles, growing ~19/hour.

**Design**:
- **Retention**: processed/ messages older than 7 days → auto-delete
- **Monthly digest**: Before deletion, compress month's messages into `inbox/digest/YYYY-MM.md`:
  ```markdown
  # Inbox Digest — 2026-03
  ## Statistics
  - Received: 142 | Processed: 140 | P0: 3 | P1: 28 | P2: 109
  ## Key Threads
  - [thread-id]: summary (3 messages)
  ```
- **Implementation**: Add to loop flow — each role checks `processed/` once per day (every ~6 loops for 30m roles). If files > 7 days old, digest then delete.
- **Alternative considered**: Keep everything (git tracks history). Rejected — pollutes `git status`, `ls`, and role context when reading inbox.

## 2. Devlog Archival

**Current state**: 31 devlogs in 5 hours, mostly in agent-architect and research.

**Design**:
- **Structure**: `devlog/YYYY-MM/` subdirectories. Monthly roll.
- **Archive trigger**: At month boundary (1st of each month), move prior month's devlogs to `devlog/YYYY-MM/`
- **Quarterly summary**: Every 3 months, compress oldest quarter's devlogs into `devlog/YYYY-QN-summary.md`
- **No auto-deletion**: Devlogs contain unique research and analysis — summarize but don't delete.

## 3. Git History Sustainability

**Current state**: 114 commits in 5 hours. Projected: ~130K commits in 6 months.

**Analysis**:
- Git handles 100K+ commits fine (Linux kernel has 1M+). Performance concern is repo SIZE, not commit count.
- Main risk: large binary files or bloated text files committed frequently.
- Memory files (short-term.md) are gitignored ✅
- Devlogs, inbox messages are small text files — negligible size impact.

**Design**:
- **No periodic squash** — destroys history, violates "no destructive git operations" rule, and git handles the count fine.
- **Shallow clones for new containers**: `git clone --depth 100` for role containers. Full history only needed for lead/research.
- **`.gitignore` hygiene**: Already ignoring short-term.md, metrics.log, heartbeat.json ✅. Add `inbox/processed/` files older than 7 days (handled by cleanup mechanism above — they're deleted, not ignored).
- **Monitor**: Add repo size check to lead's loop. If `.git/` > 500MB, investigate.

## 4. Role Auto-Scaling

**Current state**: 7 roles, several idle for extended periods (agent-architect: 18 idle loops).

**Design — Role Hibernation**:
- **Trigger**: If a role has 0 tasks completed for 20 consecutive loops AND 0 unprocessed inbox:
  - Role writes `"status": "hibernating"` to heartbeat.json
  - Container is stopped (not deleted)
  - role-card.json updated: `"status": "hibernating"`
- **Wake trigger**:
  - New inbox message arrives (lead can always write to hibernated role's inbox)
  - Lead sends `type: task` to role → Server detects inbox change → auto-starts container
- **Manual override**: User can force-start/stop via Web UI

**Implementation**:
- Server's 15-second scan checks heartbeat.json. If `hibernating` → stop container.
- Server also checks `inbox/` for non-processed files. If found + container stopped → auto-start.
- No code changes needed in roles — hibernation decision made by Server based on heartbeat state.

**Auto-scaling down (role removal)**:
- NOT automated. Role removal is a strategic decision (lead proposes, user approves).
- Hibernation is sufficient — zero resource usage when stopped, instant resume.

## 5. Evolution Drift Prevention

**Problem**: After 100+ self-audits, a role's ROLE.md may drift far from original intent. The "ship of Theseus" problem.

**Design — Constitutional Rules**:

Each ROLE.md already has section "三、硬性规则（不可自我演进修改）" in the Chinese templates. This is the "constitution" — rules that self-evolution CANNOT modify.

**Strengthen this pattern**:
- base-protocol.md sections 7 (File/Code Rules) and the "MANDATORY" markers are already constitutional.
- Add to base-protocol:
  ```markdown
  ## 12. Constitutional Rules (IMMUTABLE)
  Rules marked with 🔒 in this protocol and in ROLE.md cannot be modified by self-evolution.
  Only the user or lead (with user approval) can modify 🔒 rules.
  Evolution.log must track drift: every 25 evolutions, compare current ROLE.md to
  the original template and report % changed.
  ```
- **Drift metric**: `lines_changed / total_lines` of ROLE.md vs original template. If > 50%, flag to lead for human review.
- **Rollback capability**: Original templates exist in `.evomesh/templates/roles/`. Always possible to diff against baseline.

## Summary Table

| Mechanism | Trigger | Action | Frequency |
|---|---|---|---|
| Inbox cleanup | files > 7 days in processed/ | digest + delete | Daily |
| Devlog archive | Month boundary | Move to YYYY-MM/ subdir | Monthly |
| Devlog summary | Quarter boundary | Compress to quarterly summary | Quarterly |
| Git health | .git/ > 500MB | Investigate, shallow clone containers | Ad hoc |
| Role hibernation | 20 idle loops + 0 inbox | Stop container, auto-wake on inbox | Continuous |
| Drift detection | Every 25 evolutions | Compare ROLE.md vs template, report % | Per 25 evos |

## Self-Attack

**Q: Is inbox digest worth the complexity?**
A: Yes — without it, `ls inbox/processed/` returns thousands of files in months. Digest preserves the statistical overview. The alternative (just delete) loses cross-role analysis capability.

**Q: Will hibernation cause missed messages?**
A: No — inbox is file-based. Messages accumulate even when container is stopped. Server auto-wakes on inbox change.

**Q: 50% drift threshold too aggressive?**
A: Agent-architect's ROLE.md went from 37 lines → 35 lines over 3 evolutions (~10% change). 50% would mean the role is fundamentally different. Reasonable threshold for a flag, not a block.
