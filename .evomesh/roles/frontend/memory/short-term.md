## Done
- Built Quick Compose floating dialog for lag-free message input
  - FAB button (bottom-right) opens compose dialog over main area
  - Ctrl+/ toggle, Ctrl+Enter send, Escape close, Shift+Enter newline
  - Isolated from sidebar DOM rebuilds — no typing lag
  - Mobile: full-width bottom sheet, 16px font (prevents iOS zoom), hide kbd hints
  - Auto-resize textarea, focus management, FAB hides when dialog open
- Refactored sendFeedMsg into shared _sendMessage core for reuse

## Blockers
(None)

## In-progress
(None)

## Next focus
- UX/Product audit cycle (next idle)
- P2: migrate inline onclick handlers to addEventListener (needs lead approval)
