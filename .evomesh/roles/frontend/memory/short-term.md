## 2026-03-17 Loop 17

- **Done**:
  - Complete right panel rewrite: deleted all Mission Control tabs/panels code, replaced with unified message feed
  - HTML: replaced mc-tabs/mc-panels with simple #feed + #feed-input
  - JS: deleted initMissionControl, refreshMissionControl, renderMCFromState, renderMCActivity, renderMCIssues, renderMCTasks, sendToCentral, quickSendToCentral, addCentralMessage, simpleMarkdown (~280 lines removed)
  - JS: added initFeed, appendFeedMessage, sendFeedMsg, refreshCentralStatus (~80 lines added)
  - CSS: replaced all mc-* styles with feed-item styles (role-update, central-status, user-message, system)
  - SSE stream from /api/feed/stream for real-time role updates
  - Role-colored name tags (lead=red, core-dev=green, frontend=blue, reviewer=purple, security=orange, research=cyan, agent-architect=pink)
  - User messages right-aligned blue, system messages centered gray
  - Tests: 113/113 pass, JS syntax clean, TSC clean
- **Blockers**: None
- **In-progress**: Nothing
- **Next focus**: Verify feed works in browser after server restart
