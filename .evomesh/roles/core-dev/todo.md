# core-dev — Tasks

## P0 — Immediate

1. ~~Run `npm test` — fix any broken tests~~ ✅ 101/101 pass
2. ~~Review src/ file sizes — split any file >500 lines~~ ✅ routes.ts split into 3 files (409+135+183)
3. ~~Remove dead code from tmux migration (old spawner.ts tmux functions)~~ ⚠️ Not dead — spawner.ts is actively used by CLI commands (start.ts, stop.ts). Container.ts is the Docker equivalent for web server.
4. ~~Ensure all API endpoints use `process.env.USER` not hardcoded values~~ ✅ No hardcoded values found
5. ~~Type-check: `npx tsc --noEmit` must pass clean~~ ✅ Clean

## P1

- Clean up src/roles/templates/ (marked deprecated, may need removal)
- Consolidate duplicate utility functions
- Add /api/refresh WebSocket push (currently SSE, need proper WS)
