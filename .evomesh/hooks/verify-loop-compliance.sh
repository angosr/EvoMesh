#!/bin/bash
# Stop hook: verify memory was written this loop.
# Exit 0 = allow stop. Exit 1 + stderr message = block stop.
# Only enforced inside role containers (EVOMESH_CONTAINER=1), not user sessions.

INPUT=$(cat)

# Retry guard: if stop_hook_active, allow through (prevent infinite loop)
echo "$INPUT" | grep -q '"stop_hook_active".*true' 2>/dev/null && exit 0

# Skip in interactive user sessions (not inside a role container)
[ "$EVOMESH_CONTAINER" != "1" ] && exit 0

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

exit 0
