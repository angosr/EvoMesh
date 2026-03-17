# EvoMesh Base Protocol — Reference

> Supplements CLAUDE.md (auto-loaded). Only contains rules NOT in CLAUDE.md.
> If CLAUDE.md and this file conflict, CLAUDE.md wins.

---

## Memory Format

| File | Purpose | Limit | Git |
|---|---|---|---|
| `memory/short-term.md` | Current loop state | ≤50 lines, overwrite each loop | .gitignore |
| `memory/long-term.md` | Cross-loop knowledge | ≤200 lines, append-only | commit |
| `metrics.log` | Performance CSV | append-only | .gitignore |

**short-term format**:
```
## YYYY-MM-DD Loop N
- **Done**: ...
- **Blockers**: ...
- **In-progress**: ...
- **Next focus**: ...
```

**metrics.log format**: `timestamp,duration_s,tasks_done,errors,inbox_processed`

**Archive**: long-term > 200 lines → move oldest to `memory/archive.md`.

---

## Inbox Format

**Filename**: `YYYYMMDDTHHMM_from_topic.md`

```yaml
---
from: role-name
to: role-name    # "all" = broadcast
priority: P0|P1|P2
type: task|proposal|feedback|report|ack
date: YYYY-MM-DDTHH:MM
---
```

P0 = this loop | P1 = within 2 loops | P2 = within 1 day

---

## Coordination Topology

**Hub-and-spoke**: Cross-role communication goes through lead, except:
- P0 direct channel (security/stability → relevant role + lead)
- Bug fix direct (reviewer/security → core-dev/frontend, CC lead)
- ack replies go directly to sender

---

## Circuit Breaker

3 consecutive loop errors → write `heartbeat.json` with `circuit-open` → P0 alert to lead → stop working (keep heartbeat) → wait for lead reset.
