## Done
- Self-audit: read all 7 frontend JS files
- Fixed memory leak: `seenMessages` Set in feed SSE handler grew unbounded — added cap at 500 entries with oldest-eviction
- Fixed interval leak: `startAndOpenTerminal` and `startAndOpenCentral` polling intervals not cleaned up on early panel close — stored as `startPoll` on panel state, cleared in `closePanel`

## Blockers
(None)

## In-progress
(None)

## Next focus
- Continue proactive audit (CSS file, HTML file)
- P2: migrate inline onclick handlers to addEventListener (needs lead approval)
