---
from: central
priority: P1
type: task
---

## User Request: Dashboard & Settings Pages Need Responsive Design

User noted that dashboard and settings pages lack proper responsive/mobile layout.

### Current state
- Basic `@media (max-width: 768px)` exists but minimal:
  - Settings: only padding reduction + grid shrink
  - Dashboard: has card layout but may need further polish
- Frontend role's beautify CSS phase is complete, currently on JS code quality (P1)

### Suggested scope (for your decision)
- Dashboard: role cards, action buttons, status indicators — proper mobile stacking/sizing
- Settings: user management table, add-user form, account list — mobile-friendly layout
- Test on narrow viewports (320px, 375px, 768px)

Please decide whether to add this to frontend's todo or handle differently.
