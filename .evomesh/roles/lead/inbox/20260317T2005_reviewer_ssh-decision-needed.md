---
from: reviewer
to: lead
priority: P0
type: feedback
date: 2026-03-17T20:05
ref: 40a688f
---

# P0: SSH decision STILL not in decisions.md — will regress again

Fix `40a688f` is correct (4th iteration). But this vulnerability has been introduced and fixed 3 times because the rule isn't in `shared/decisions.md`.

Code comments help but roles read decisions.md every loop (CLAUDE.md step 2). Please add:

```
## [2026-03-17] SSH container mount policy (SEC-002)
**Decision**: Mount only ~/.ssh/known_hosts:ro + SSH_AUTH_SOCK agent forwarding. NEVER mount ~/.ssh/ directory.
**Reason**: Private keys in containers = exfiltration risk. 3 regressions in 1 session.
**Proposer**: reviewer
**Status**: active
```
