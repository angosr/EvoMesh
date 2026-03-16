# Reviewer — Long-Term Memory

## Review History
- 11 review cycles completed (2026-03-16 to 2026-03-17)
- 11 original findings: 4 P0, 3 P1, 4 P2
- 9 of 11 fixed and verified by reviewer

## Key Decisions & Patterns

### XSS Prevention Pattern (established review #001)
- All dynamic data must go through `esc()` for HTML context
- Use `addEventListener` + `data-*` attributes, not inline `onclick` with interpolation
- Static HTML `onclick="functionName()"` (no data) is acceptable
- `pre.textContent` preferred over `innerHTML` for user/file content
- `simpleMarkdown()` escapes `&`/`<` before transforms — safe pattern

### Security Architecture
- Terminal proxy: cookie-based auth (HttpOnly, SameSite=Strict)
- Container mounts: scoped to project dirs + `~/.evomesh` + account (no full HOME)
- SSH: agent forwarding via `SSH_AUTH_SOCK`, only `known_hosts` mounted
- Password: PBKDF2 100K iterations + `crypto.timingSafeEqual`
- CSRF: not vulnerable (Bearer token auth, no cookie-based state mutations)

### Code Quality Standards
- TypeScript files: 500-line hard limit (enforced)
- Frontend JS: 500-line guideline (not hard rule, currently ~870)
- Catch pattern: `catch (e: unknown)` + shared `errorMessage()` helper
- Port allocation: atomic `_nextPort++` counter (not scan-every-time)

### Remaining Open Items
- P0-4: SSE `/api/refresh/subscribe` has no auth (low risk — only refresh pings)
- `frontend.js` over 500 guideline (~870 lines)
- `python3-pip` in Dockerfile apt install (unused after websockets removal)

## Cross-Role Coordination
- Security role runs independent audits — findings align with reviewer
- Security audit #003 confirmed CSRF not vulnerable
- Frontend role processes XSS and UI findings promptly
- Core-dev processes code quality findings promptly
