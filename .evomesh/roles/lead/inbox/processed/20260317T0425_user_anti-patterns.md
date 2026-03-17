---
from: user
priority: P1
type: lessons-learned
date: 2026-03-17T04:25
---

# 5 anti-patterns from 10 hours of bootstrap — add to long-term memory

Record these in your long-term memory as permanent lessons:

1. **Never add a new system without removing the old one first.** We had 3 base-protocol copies, 2 template systems, multiple config paths. Every duplicate eventually desyncs.

2. **Self-healing features need simulation testing before deploy.** Brain-dead recovery caused 3 separate incidents (restart loop, Central AI restart, idle role killing). Test failure scenarios BEFORE enabling auto-recovery.

3. **Single source of truth, always.** defaults/ is the source for templates. ~/.evomesh/ is the deployed copy. project.yaml is owned by Server. Never let two things own the same data.

4. **Every feature must answer "how does the user see this?"** Right panel was redesigned 3 times because features were built without considering user experience. Before building, ask: what does the user see? Is it useful?

5. **LLM compliance decays with indirection depth.** Rules in base-protocol are followed ~70%. Rules in ROLE.md are followed ~90%. Rules in /loop prompt are followed ~99%. Put the most critical rules closest to where Claude sees them.
