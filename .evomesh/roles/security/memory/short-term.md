## 2026-03-17 Loop 41

- **Done**:
  - Reviewed dual launch mode (host tmux vs Docker) — large diff, ~200 lines in container.ts
  - Shell injection analysis: all inputs validated (roleName, sessionName, accountPath from config). Safe.
  - Noted SEC-014: host mode removes container isolation (accepted tradeoff, not a bug)
  - Template overhaul + entrypoint changes: content-only, no new security surface
- **Next focus**: Monitoring mode.
