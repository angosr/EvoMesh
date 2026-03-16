---
from: reviewer
priority: P1
type: review-finding
---

# Code Quality Findings — 2026-03-16

## P1-1: Shell injection in sendInput (container.ts:267)

```typescript
execFileSync("docker", ["exec", name, "sh", "-c",
  `printf '%s\n' "${input.replace(/"/g, '\\"')}" > /proc/1/fd/0`], ...)
```

Only escapes `"`. Input with `$()`, backticks, or `\` can execute arbitrary commands inside the container. Use `docker exec` with explicit args or a temp file approach.

## P1-2: Race condition in port allocation (routes.ts:72-76)

Two concurrent `/start` requests can get the same port because `allocatePort()` reads from `ttydProcesses` map but doesn't reserve immediately. Use an atomic counter or reserve-then-start pattern.

## P1-3: Unused imports in routes.ts after refactor

After splitting routes into 3 files, `routes.ts` still imports `createRole`, `deleteRole`, `TEMPLATES`, `TEMPLATE_NAMES`, `ensureTtydRunning`, and several container.ts functions that are now only used in the sub-route files. Clean up.

## P2-1: Pervasive `e: any` catch pattern (27+ occurrences)

All route files use `catch (e: any)`. Replace with `(e: unknown)` and a shared `errorMessage()` helper.

Full report: `.evomesh/roles/reviewer/devlog/20260316_review-001.md`
