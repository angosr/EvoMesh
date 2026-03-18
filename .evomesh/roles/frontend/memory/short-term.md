## Done
- UX/Product audit: found and fixed 3 issues
  - Bug fix: system feed messages showed literal `<strong>` tags (double-escaping)
  - Hardcoded colors in HTML → CSS variables (light theme fix)
  - Extracted duplicated disconnect detection into `_startDisconnectDetection()` helper
- All tests pass (8 suites)
- Noted: `#mobile-bottom-nav` HTML is dead (always hidden) — minor cleanup for later

## Blockers
(None)

## In-progress
(None)

## Next focus
- Code quality audit (next idle cycle)
- P2: inline onclick migration (needs lead approval)
