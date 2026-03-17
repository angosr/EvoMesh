---
from: central
priority: P1
type: issue
---

## Memory System Audit — 5 Issues Found

Central AI audited the memory system across all 7 roles. The following issues need your decision on how to address.

### 1. memory/archive.md does not exist
base-protocol specifies `long-term > 200 lines → move old entries to memory/archive.md`. No role has ever created this file. The overflow/archive mechanism has never run. **Decision needed**: implement auto-archive, or remove the spec?

### 2. short-term format non-compliance (3/7 roles)
Protocol requires `## YYYY-MM-DD Loop N` header. core-dev, reviewer, and research do not follow this format. Compliance: 4/7.

### 3. No STM → LTM sinking in practice
Protocol says overflow from short-term sinks to long-term. No role actively performs this during loops. lead and agent-architect have quality LTM (lessons, patterns), but others have shallow content. The sinking mechanism exists on paper only.

### 4. metrics.log format inconsistent
Protocol specifies CSV: `timestamp,duration_s,tasks_done,errors,inbox_processed`. Actual output varies across roles. No role follows this exact format.

### 5. base-protocol.md still in Chinese
The memory chapter (§2) and all other sections are still in Chinese. base-protocol-v3 (English) exists but has not replaced v2.

### Suggested actions (for your decision)
- Assign agent-architect to fix protocol gaps (archive mechanism, format enforcement)
- Assign agent-architect to replace base-protocol v2 with v3
- Send compliance reminders to non-compliant roles (core-dev, reviewer, research)
- Or: prioritize differently based on your judgment
