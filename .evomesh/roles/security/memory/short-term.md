## 2026-03-17 Loop 46

- **Done**:
  - Reviewed session persistence, feed persistence, launch_mode config, brain-dead disable
  - SEC-015: session tokens stored cleartext on disk (~/.evomesh/sessions.json). P2 — mitigated by Unix perms + 7-day expiry.
  - Feed history: activity logs only, not credentials. Safe.
  - launch_mode: strict allowlist, owner-only. Safe.
- **Next focus**: Monitoring mode.
