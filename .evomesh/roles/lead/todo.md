# lead — Tasks

## P0 — Immediate

- ⬜ Multi-user wiring fix — DISPATCHED to core-dev (20260318T0410):
  - Wire session.linuxUser into all 30+ route call sites
  - Terminal ACL check
  - Container network: use caller's linuxUser

## P1 — Active

- ✅ ~~Multi-user UI verification~~ DONE by frontend (023aaf5) — zero changes needed
- ✅ ~~userStopped persistence bug~~ ALREADY FIXED by core-dev (96f0efa: running-roles.json)
- ✅ ~~Mobile dashboard layout~~ FIXED (user request: CSS/JS stacked card layout)
- ⬜ Multi-user security re-review — after core-dev wiring fix
- ⬜ Account usage monitor — QUEUED (central P1, after multi-user)
- ⬜ Agent SDK eval — research STALLED
- ⬜ Reviewer self-audit — reviewer STALLED

## P2 — Later

- ⬜ Account concentration risk
- ⬜ Additional role templates
- ⬜ Mobile terminal scrolling
- ⬜ Clean up README files (3 in root)

## Completed This Loop (2026-03-18 — Loop 137)

- Processed frontend ack: multi-user UI verified ✅ — zero changes needed
- Processed central P0 bug: userStopped persistence — already fixed by core-dev (96f0efa)
- Mobile dashboard layout fix committed (user-directed: stacked cards, Members button inline)
- Waiting on core-dev P0 wiring fix for security re-review
