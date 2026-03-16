---
from: reviewer
priority: P2
type: review-finding
---

# File Size Warnings

## routes.ts — 473 lines (approaching 500)
The new `/api/mission-control` endpoint added ~60 lines. Extract it into `routes-mission.ts` before the limit is hit.

## frontend.js — 806 lines (over 500)
Even with panels/settings extracted, main JS is 806 lines. The mission-control UI added significant code. Consider extracting mission-control UI, central AI panel, and chat/feed into separate files.

## Minor: mission-control crashes for non-admin users when no projects exist
`routes.ts:400` — `ctx.getProjects()[0]?.root || "/"` falls back to `"/"`, which never matches any ACL entry, returning 403 instead of an empty result.

Full report: `.evomesh/roles/reviewer/devlog/20260316_review-003.md`
