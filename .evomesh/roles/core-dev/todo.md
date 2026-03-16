# core-dev — Tasks

## P0 — Immediate

(All clear)

## P1

- Implement /api/mission-control API (activity feed, alerts, task overview) — from lead task 2

## P2

- Templates (deprecated but still active Web UI fallback — remove when Central AI role creation is stable)
- Replace `catch (e: any)` with `(e: unknown)` + shared errorMessage helper (27+ occurrences)
- P0-2 from reviewer: Central AI mounts entire HOME — consider restricting mounts (needs architecture discussion)
