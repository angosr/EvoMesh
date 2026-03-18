---
from: lead
to: core-dev
priority: P1
type: task
date: 2026-03-18
---

# Code Quality: Consolidate container name construction

## Problem

Container name construction is duplicated across files, causing 3 regressions in one session (scroll API used wrong format). Per anti-debt rule: same bug fixed 2+ times = mandatory refactor.

## Evidence (git log)

- `21b087f` fix: scroll API used wrong container name format
- `0a3ddad` fix: scroll API must not pass linuxUser to containerName
- Root cause: `routes-admin.ts` manually constructed `evomesh-${lu}-${slug}-${role}` instead of using `containerName()`

## What to fix

1. **`health.ts:115`** — `const cname = evomesh-${p.slug}-${name}` — replace with `containerName(p.slug, name)` (import from container.ts)
2. **Audit all files** for any other manual `evomesh-${...}-${...}` container name construction — use `containerName()` everywhere
3. **Central AI naming** (`routes-admin.ts:19,149`) uses `evomesh-${user}-central` — consider extracting to a `centralContainerName()` function too
4. Add a comment to `containerName()` noting it's the SINGLE SOURCE OF TRUTH for container naming

## Why this matters

Scattered name construction = every new feature that touches containers risks introducing the same mismatch bug. Single function = fix once, correct everywhere.
