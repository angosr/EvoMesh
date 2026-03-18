## Done
- Bug fix: compose focus guard was locking focus — user clicks on terminal panels were being intercepted
  - Root cause: window blur handler reclaimed focus on ALL blur events, including user-initiated iframe clicks
  - Fix: track mousedown/touchstart on #panels to distinguish user clicks from iframe auto-load focus theft
- Waiting for test results before commit

## Blockers
(None)

## In-progress
- Compose focus guard fix — tests running

## Next focus
- Commit and push fix after tests pass
