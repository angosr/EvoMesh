#!/bin/bash
set -e

# Run as root initially to set up user, then drop privileges
TARGET_UID=${HOST_UID:-1000}
TARGET_GID=${HOST_GID:-1000}
TARGET_USER=${HOST_USER:-user}
TARGET_HOME=${HOST_HOME:-/home/$TARGET_USER}

# Create group and user matching host
groupadd -g "$TARGET_GID" "$TARGET_USER" 2>/dev/null || true
useradd -u "$TARGET_UID" -g "$TARGET_GID" -d "$TARGET_HOME" -s /bin/bash "$TARGET_USER" 2>/dev/null || true

export HOME="$TARGET_HOME"

# Session resume logic
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$TARGET_HOME/.claude}"
SESSION_FILE="${CONFIG_DIR}/.session-id"
CLAUDE_ARGS="--dangerously-skip-permissions"

if [ -f "$SESSION_FILE" ] && [ -s "$SESSION_FILE" ]; then
  SID=$(cat "$SESSION_FILE")
  CLAUDE_ARGS="--resume $SID $CLAUDE_ARGS"
  echo "[evomesh] Resuming session: $SID"
else
  CLAUDE_ARGS="--name ${ROLE_NAME:-role} $CLAUDE_ARGS"
  echo "[evomesh] Starting fresh session for: ${ROLE_NAME:-role}"
fi

# Graceful shutdown
cleanup() {
  echo "[evomesh] Shutting down..."
  HISTORY="${CONFIG_DIR}/history.jsonl"
  if [ -f "$HISTORY" ]; then
    SID=$(tail -1 "$HISTORY" 2>/dev/null | grep -o '"sessionId":"[^"]*"' | head -1 | cut -d'"' -f4)
    [ -n "$SID" ] && echo "$SID" > "$SESSION_FILE"
  fi
  kill -TERM $(pgrep -f "claude" 2>/dev/null) 2>/dev/null || true
  wait
  exit 0
}
trap cleanup SIGTERM SIGINT

echo "[evomesh] Starting as $TARGET_USER (uid=$TARGET_UID)..."

# ttyd wraps claude directly — supports multiple browser tabs sharing same session
# From terminal: open http://localhost:<port> in browser, or use the EvoMesh web UI
exec gosu "$TARGET_USER" ttyd \
  --writable \
  -t fontSize=14 \
  -t scrollback=10000 \
  --port 7681 \
  -- /usr/local/bin/claude $CLAUDE_ARGS
