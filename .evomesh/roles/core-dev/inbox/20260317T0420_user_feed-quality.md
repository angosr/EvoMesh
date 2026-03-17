---
from: user
priority: P0
type: bug
date: 2026-03-17T04:20
---

# Feed has 3 critical problems

## 1. Messages repeat 4x
The same block of messages (11:14-11:41) appears 4 times in the feed. Root cause: SSE reconnects on server watch-mode restart, and feed history is replayed each time without dedup.

Fix: add message ID (hash of role+text+time) and dedup in frontend:
```javascript
const seenIds = new Set();
es.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  const id = `${msg.role}:${msg.text}:${msg.time}`;
  if (seenIds.has(id)) return;
  seenIds.add(id);
  appendFeedMessage(msg);
};
```

## 2. Idle messages are noise
"No pending tasks, idle", "status updated", "Appended metrics.log" — these have zero value. Filter them out.

Server-side filter in SSE endpoint: skip messages that match idle patterns:
```typescript
const NOISE = /idle|no pending|no inbox|appended metrics|status updated|no code changes/i;
if (NOISE.test(latest)) continue; // don't push
```

Only push messages where the role ACTUALLY DID something.

## 3. Feed language should follow user preference
Memory/short-term.md is gitignored — it CAN be any language. But roles write English because their ROLE.md is English.

Solution: add a `lang` field to the server config or workspace.yaml. Central AI's ROLE.md already has language detection. For role feed messages, the simplest fix:
- Add to base-protocol: "Write memory/short-term.md Done line in the project's `lang` field from project.yaml"
- Server reads project.yaml `lang` field and passes it in the SSE event
- This way: committed files stay English, but the user-visible memory summary follows project language

Not urgent — fix #1 and #2 first.
