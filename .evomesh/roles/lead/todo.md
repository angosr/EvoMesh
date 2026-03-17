# lead — Tasks

## P0 — Immediate

- ⬜ Multi-user wiring — DISPATCHED to core-dev (20260318T0410):
  - Wire session.linuxUser into all 30+ route call sites
  - Terminal ACL check (requireProjectRole before proxy)
  - Container network: use caller's linuxUser, not process.env.USER
  - Security review FAILED — scaffolding exists but nothing is connected

## P1 — Active

- ✅ ~~Multi-user Phases 1+2~~ Scaffolding done but NOT WIRED (security FAIL)
- ✅ ~~Feed initial-state fix~~ applied
- ✅ ~~Devlog Chinese cleanup~~ DONE
- ⬜ Multi-user security re-review — after core-dev wiring fix
- ⬜ Multi-user UI verification — frontend dispatched, blocked on wiring fix
- ⬜ Account usage monitor — QUEUED (after multi-user)
- ⬜ Agent SDK eval — research STALLED
- ⬜ Reviewer self-audit — reviewer STALLED

## P2 — Later

- ⬜ Account concentration risk
- ⬜ Additional role templates
- ⬜ Mobile terminal scrolling
- ⬜ Reviewer/security merge
- ⬜ Clean up README files (3 in root)

## Completed This Loop (2026-03-18 — Loop 136)

- Processed security P0 review: FAIL — 4 P0 findings. Scaffolding correct but session.linuxUser never used
- Dispatched concrete wiring fix to core-dev with exact file:line locations from security
- This is a mechanical search-replace fix, not a design issue
