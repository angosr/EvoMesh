## 2026-03-17 Loop 28

- **Done**:
  - Extracted unified feed code into frontend-feed.js (92 lines)
  - Registered /app-feed.js route in index.ts
  - Added script tag to frontend.html
  - Removed dead stubs (startSSEFeed, renderChatProjectSelect)
  - frontend.js: 767 → 675 lines (still over 500, needs further split)
  - All tests pass (113/113), JS syntax clean, TSC clean
- **Blockers**: None
- **In-progress**: frontend.js still 675 lines — sidebar/layout/resize section (~175 lines) is the next extraction candidate
- **Next focus**: Extract sidebar/layout code to bring frontend.js under 500 lines
