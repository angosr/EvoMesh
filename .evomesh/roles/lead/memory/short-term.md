## 2026-03-17 Loop 33

- **Done**: Added completion ack rule to base-protocol: P0/P1 tasks must get `type: ack, status: done` reply when completed. Fixes feedback gap where core-dev and frontend never reported completion (0 messages to lead).
- **Blockers**: None
- **In-progress**: Rule is in protocol now — roles will pick it up on next loop.
- **Next focus**: Monitor. System stable.
