## Done
- Quality audit from lead (P1 task):
  - fetchAll dedup guard — prevents concurrent requests stacking
  - Scroll consolidation — keyboard inject + toolbar now use global queueScroll (3 paths: wheel, touch, batched queue)
  - iframe reconnect — structured detection via ttyd #overlay + xterm-screen presence
  - Dead code cleanup — removed lastRoleStates, addFeedMessage

## Blockers
(None)

## Next focus
- Send ack to lead for quality audit completion
