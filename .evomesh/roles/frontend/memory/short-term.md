# Frontend — Short-Term Memory

## Last Loop (Loop 4 — 2026-03-16)

### Done
- Fixed regression: restored accidentally deleted Add Project form, Role Modal, and all associated JS functions (showAddForm, hideAddForm, doAddProject, showRoleModal, closeRoleModal, doCreateRole, path autocomplete)
- Kept XSS-safe autocomplete (addEventListener instead of inline onclick)
- Verified all HTML onclick → JS function references are intact

### Blockers
- `/api/mission-control` endpoint not yet implemented by core-dev — Tasks tab shows placeholder
- No browser in environment — using curl + Node.js syntax checks + smoke tests

### In Progress
- Loading state for action buttons (P2) — deferred to fix regression this loop

### Next Loop Focus
- P2: Add loading spinners/disabled state to async action buttons (restart, delete, add)
- P1: Settings page polish
- P2: Copy dialog improvement for mobile
