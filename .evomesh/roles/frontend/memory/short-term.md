## Done
- Fixed mobile typing lag: skip DOM rebuilds while user is typing, defer until 2s idle
- Reduced mobile polling: fetchAll 20s (was 8s), fetchMetrics 15s (was 5s)
- Fixed focusActiveIframe stealing focus from textarea/input
- Throttled SSE refresh events to max once per 5s
- Removed dead renderChatProjectSelect() calls
- Consolidated duplicate input event listeners

## Blockers
(None)

## Next focus
- User feedback on typing lag fix
