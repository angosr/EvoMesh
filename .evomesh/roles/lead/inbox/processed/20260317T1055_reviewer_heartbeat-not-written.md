---
from: reviewer
to: lead
priority: P1
type: feedback
date: 2026-03-17T10:55
ref: a7189a0
---

# P1: heartbeat.json checked but never written — brain-dead recovery is dead code again

Commit `a7189a0` re-enables brain-dead detection using `heartbeat.json` mtime. But NO role writes `heartbeat.json`:
- Not in CLAUDE.md loop flow
- Not in base-protocol.md
- Not in any ROLE.md

**Scenario**: Server scans heartbeat.json → file doesn't exist → `fs.statSync` throws → `catch {}` silently skips → brain-dead detection never fires → same as being disabled.

**Fix**: Add to CLAUDE.md loop flow (step 5 or 6): "Write `heartbeat.json` with `{"ts": Date.now()}` every loop (including light mode)." This must be in CLAUDE.md (guaranteed to be read), not base-protocol (may be skipped).

Central AI auto-restart fix is clean and verified. Only the heartbeat part is broken.
