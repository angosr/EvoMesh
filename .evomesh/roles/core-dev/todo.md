# core-dev — Tasks

## P0 — Immediate

(All clear)

## P1

- ~~Migrate smartInit() to file-based templates~~ ✅ Done — reads from ~/.evomesh/templates/ or project-local, falls back to hardcoded. Account round-robin picks least-loaded.

## P2

- Templates (deprecated code templates in src/roles/templates/ — remove when Central AI role creation is stable)
- Extract mission-control into routes-mission.ts if routes.ts grows further
