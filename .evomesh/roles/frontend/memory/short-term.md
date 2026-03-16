# Frontend — Short-Term Memory

## Last Loop (Loop 6 — 2026-03-16)

### Done
- Refined Mission Control rendering for API consumption:
  - Activity: sorts by time descending (newest first)
  - Issues: maps `type` field (stopped→red, stale→yellow, p0-pending→red) + "View Log" button
  - Tasks: sorts by priority P0→P1→P2
- Accepted user upstream changes: simpleMarkdown, Central AI chat-style input, quickSendToCentral, terminal auth token, send button loading state

### Blockers
- `/api/mission-control` endpoint still pending core-dev — fallback rendering active

### In Progress
- Nothing — refinement loop

### Next Loop Focus
- P2: Loading spinners for dashboard action buttons (restart, delete)
- P1: Settings page polish
