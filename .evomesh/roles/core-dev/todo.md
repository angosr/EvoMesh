# core-dev — Tasks

## P0 — Immediate

(All clear)

## P1

(All clear)

## P2

- Templates (deprecated but still active Web UI fallback — remove when Central AI role creation is stable)
- ~~Replace `catch (e: any)` with `(e: unknown)` + shared errorMessage helper~~ ✅ Done — 23 occurrences across 4 files, created src/utils/error.ts
- Central AI mounts entire HOME — consider restricting mounts (needs architecture discussion)
