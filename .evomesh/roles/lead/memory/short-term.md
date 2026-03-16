## 2026-03-17 Loop 34

- **Done**:
  - Sent P0 to frontend: stop spawning server processes in container (5 zombies found)
  - Added "no long-running background processes" rule to base-protocol section 7
- **Blockers**: None
- **In-progress**: Frontend needs to clean up zombie processes
- **Next focus**: Monitor. Consider --pids-limit for containers as P2.
