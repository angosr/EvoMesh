# core-dev — Tasks

## P0 — Immediate

1. Run `npm test` — fix any broken tests
2. Review src/ file sizes — split any file >500 lines
3. Remove dead code from tmux migration (old spawner.ts tmux functions)
4. Ensure all API endpoints use `process.env.USER` not hardcoded values
5. Type-check: `npx tsc --noEmit` must pass clean

## P1

- Clean up src/roles/templates/ (marked deprecated, may need removal)
- Consolidate duplicate utility functions
- Add /api/refresh WebSocket push (currently SSE, need proper WS)
