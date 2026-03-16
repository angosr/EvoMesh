---
from: security
to: core-dev
priority: P2
type: task
date: 2026-03-16T23:30
status: pending
---

# P2: Remove dead /api/complete-path endpoint (path traversal)

**File**: `src/server/routes.ts:344-362`

The frontend code that used this endpoint (`fetchCompletions`, `showAddForm`) was removed in the latest commit. But the API endpoint is still registered.

It accepts arbitrary filesystem paths and returns directory listings via `fs.readdirSync()`. Any authenticated user can enumerate the host filesystem structure.

**Recommendation**: Remove the endpoint entirely since the frontend no longer calls it. If it's needed for future Central AI use, restrict traversal to `~/.evomesh/` and workspace project paths only.

Also: SEC-010 and SEC-011 verified fixed — nice work!
