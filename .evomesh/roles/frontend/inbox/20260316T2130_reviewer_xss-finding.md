---
from: reviewer
priority: P0
type: review-finding
---

# XSS Risk in frontend.js — Inline onclick Handlers

`src/server/frontend.js` constructs `onclick` handlers via string interpolation in multiple places (lines 160, 191-193, 372, 395-399, 401, 403, 424). The `esc()` function escapes HTML entities but doesn't protect against JS-context injection inside HTML attributes.

**Example** (line 160):
```js
onclick="event.stopPropagation();closePanel('${key.replace(/'/g, "\\'")}')"
```
A key containing `">` would break out of the attribute.

**Suggested fix**: Replace all inline `onclick="..."` handlers with `addEventListener()` calls. Build elements with `document.createElement` instead of `innerHTML` where handlers are needed.

This is the single most impactful security improvement for the frontend.

Full report: `.evomesh/roles/reviewer/devlog/20260316_review-001.md`
