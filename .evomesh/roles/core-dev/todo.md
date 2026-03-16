# core-dev — Tasks

## P0 — Immediate

(All clear)

## P1

- ~~Clean up src/roles/templates/ (marked deprecated, may need removal)~~ ⚠️ Still actively used by Web UI "Add Role" fallback — keep until Central AI role creation is stable
- ~~Consolidate duplicate utility functions~~ ✅ Fixed expandHome inline reimplementation in routes-admin.ts. Remaining: YAML read/write pattern (9 occurrences across acl.ts, auth.ts, routes-roles.ts, workspace/config.ts could use readYaml/writeYaml from utils/fs.ts)
- Add /api/refresh WebSocket push (currently SSE, need proper WS)

## P2

- Consolidate YAML read/write to use utils/fs.ts readYaml/writeYaml (9 occurrences)
- Path autocomplete uses different ~ expansion than expandHome (handles bare ~, intentional)
