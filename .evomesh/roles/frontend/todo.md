# frontend — Tasks

## Completed
- [x] Dashboard table responsive on mobile
- [x] XSS fix: inline onclick → addEventListener
- [x] Unified feed rewrite (replaced MC tabs)
- [x] Mobile optimizations (full-screen, touch, keyboard-safe)
- [x] Loading states, copy dialog, smoke tests
- [x] Swipe-to-close, dark/light theme
- [x] Stop button + launch mode dropdown
- [x] Empty dashboard onboarding card
- [x] Brand visual direction: "Command Center" — JetBrains Mono + Plus Jakarta Sans
- [x] Color system: blue-shifted dark, accent glow, CSS variable hierarchy
- [x] Micro-animations: panel fadeIn, feed slideIn, button transitions
- [x] CSS variable conversion: 130+ → ~27 hardcoded hex (~80% converted)
- [x] Mobile touch target fix + host tmux arrow keys fix

## P1 — JS Code Quality
- [ ] Review frontend.js for function splitting opportunities (currently ~700 lines)
- [ ] Eliminate duplicate logic (e.g. fetch+error patterns)
- [ ] Ensure all event bindings use addEventListener (no inline handlers remaining)

## P2
- [ ] Convert remaining ~27 intentional hex values if possible
- [ ] Mobile-specific polish pass
