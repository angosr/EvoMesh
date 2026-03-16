#!/bin/bash
set -e

SESSION_FILE="/home/evomesh/.claude/.session-id"
CLAUDE_ARGS="--dangerously-skip-permissions"

# Resume or fresh start
if [ -f "$SESSION_FILE" ] && [ -s "$SESSION_FILE" ]; then
  SID=$(cat "$SESSION_FILE")
  CLAUDE_ARGS="--resume $SID $CLAUDE_ARGS"
  echo "[evomesh] Resuming session: $SID"
else
  CLAUDE_ARGS="--name ${ROLE_NAME:-role} $CLAUDE_ARGS"
  echo "[evomesh] Starting fresh session for: ${ROLE_NAME:-role}"
fi

# Graceful shutdown: save session ID before exit
cleanup() {
  echo "[evomesh] Shutting down..."
  if [ -f "/home/evomesh/.claude/history.jsonl" ]; then
    SID=$(tail -1 /home/evomesh/.claude/history.jsonl 2>/dev/null | grep -o '"sessionId":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$SID" ]; then
      echo "$SID" > "$SESSION_FILE"
      echo "[evomesh] Saved session: $SID"
    fi
  fi
  kill -TERM $(pgrep -f "claude" 2>/dev/null) 2>/dev/null || true
  wait
  exit 0
}
trap cleanup SIGTERM SIGINT

echo "[evomesh] Starting ttyd + claude..."

# Start ttyd wrapping claude directly (no tmux)
exec ttyd \
  --writable \
  -t fontSize=14 \
  -t scrollback=10000 \
  --port 7681 \
  -- claude $CLAUDE_ARGS
