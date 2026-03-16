# core-dev — Tasks

## P0 — Immediate

(All clear)

## P1

(All clear)

## P2

- ~~Consolidate YAML read/write~~ ✅ Replaced 9 inline YAML.parse/YAML.stringify patterns with readYaml/writeYaml from utils/fs.ts across acl.ts, auth.ts, workspace/config.ts, routes-roles.ts
- Templates (deprecated but still active Web UI fallback — remove when Central AI role creation is stable)
- ~~SSE→WS for /api/refresh~~ ⚠️ Not needed — SSE is correct for one-way push
