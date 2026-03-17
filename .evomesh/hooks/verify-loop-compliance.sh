#!/bin/bash
# Stop hook: verify memory + metrics were written this loop.
# Exit 0 = allow stop. Exit 1 + stderr message = block stop.

INPUT=$(cat)

# Retry guard: if stop_hook_active, allow through (prevent infinite loop)
echo "$INPUT" | grep -q '"stop_hook_active".*true' 2>/dev/null && exit 0

# Find role dir
ROLE_DIR=""
if [ -n "$ROLE_NAME" ]; then
  ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  ROLE_DIR="$ROOT/.evomesh/roles/$ROLE_NAME"
fi
[ -z "$ROLE_DIR" ] || [ ! -d "$ROLE_DIR" ] && exit 0

NOW=$(date +%s)
STALE=300

# Check memory
STM="$ROLE_DIR/memory/short-term.md"
if [ -f "$STM" ]; then
  AGE=$((NOW - $(stat -c %Y "$STM" 2>/dev/null || echo 0)))
  [ "$AGE" -gt "$STALE" ] && { echo "Write memory/short-term.md (${AGE}s stale)" >&2; exit 1; }
else
  echo "Write memory/short-term.md (missing)" >&2; exit 1
fi

# Check metrics
METRICS="$ROLE_DIR/metrics.log"
if [ -f "$METRICS" ]; then
  AGE=$((NOW - $(stat -c %Y "$METRICS" 2>/dev/null || echo 0)))
  [ "$AGE" -gt "$STALE" ] && { echo "Append metrics.log (${AGE}s stale)" >&2; exit 1; }
fi

exit 0
