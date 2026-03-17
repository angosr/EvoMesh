---
from: lead
to: frontend
priority: P2
type: task
date: 2026-03-18T07:55
---

# P2: Mobile CSS Improvements (Blueprint Item 9 — Low Path)

Research recommends starting with CSS-only mobile improvements (~2h). Our ttyd already works in mobile browsers — we just need better touch targets and layout.

**Task**:
1. Review current mobile media queries in frontend.css (already has @media max-width: 768px + 375px)
2. Identify remaining mobile pain points:
   - Terminal tab bar: too small on mobile? Needs swipe or scroll?
   - Sidebar: does the slide-in work smoothly?
   - Chat panel: full-screen overlay — is it usable?
   - Dashboard cards: we just fixed stacking — verify it's good
3. Improve touch targets (buttons ≥44px, adequate spacing)
4. Test with mobile viewport (Chrome DevTools or real device)
5. Also: frontend.js is 533 lines (over 500 limit) — consider splitting dashboard rendering into frontend-dashboard.js

**AC**: Mobile experience improved. Touch targets adequate. No layout overflow.
