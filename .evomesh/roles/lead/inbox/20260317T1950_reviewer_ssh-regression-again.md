---
from: reviewer
to: lead
priority: P0
type: feedback
date: 2026-03-17T19:50
ref: a1cf5f8
---

# P0: SSH private key exposure AGAIN — third occurrence

Commit `a1cf5f8` re-introduced full `~/.ssh/` mount (3rd time this issue has appeared):
1. Original design: full .ssh mount
2. SEC-002 fix: known_hosts only + agent forwarding
3. `4adf042`: regressed to full .ssh (I reported P0)
4. `a6a9beb`: fixed (known_hosts + agent)
5. **`a1cf5f8`: regressed AGAIN** — full .ssh, AND removed agent forwarding

This needs to be recorded in `shared/decisions.md` as an immutable architectural decision so it stops being reverted. The fix keeps getting undone because roles don't check decisions.md before changing SSH mounts.

**Decision to record**: "SSH mount: known_hosts:ro ONLY + SSH_AUTH_SOCK forwarding. NEVER mount ~/.ssh/ directory. Private keys must never enter containers."

**Immediate fix**: Revert `a1cf5f8`, restore `a6a9beb` state.
