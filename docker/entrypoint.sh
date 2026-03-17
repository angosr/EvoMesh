#!/bin/bash
set -e

# Create user matching host (runs as root, then drops to user)
TARGET_UID=${HOST_UID:-1000}
TARGET_GID=${HOST_GID:-1000}
TARGET_USER=${HOST_USER:-user}
TARGET_HOME=${HOST_HOME:-/home/$TARGET_USER}

groupadd -g "$TARGET_GID" "$TARGET_USER" 2>/dev/null || true
useradd -u "$TARGET_UID" -g "$TARGET_GID" -d "$TARGET_HOME" -s /bin/bash "$TARGET_USER" 2>/dev/null || true

# Everything below runs as the target user via exec gosu
exec gosu "$TARGET_USER" bash << 'USEREOF'
set -e

export HOME="${HOST_HOME:-$HOME}"

# Session resume
WORK_DIR="${PWD:-/project}"
ROLE_SESSION_DIR="${ROLE_ROOT_OVERRIDE:-.evomesh/roles/${ROLE_NAME:-role}}"
ROLE_SESSION_FILE="${WORK_DIR}/${ROLE_SESSION_DIR}/.session-id"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
HISTORY_FILE="${CONFIG_DIR}/history.jsonl"
CLAUDE_ARGS="--dangerously-skip-permissions"

SESSION_ID=""
if [ -f "$ROLE_SESSION_FILE" ] && [ -s "$ROLE_SESSION_FILE" ]; then
  SESSION_ID=$(cat "$ROLE_SESSION_FILE")
  echo "[evomesh] Found saved session: $SESSION_ID"
fi

IS_RESUME=false
if [ -n "$SESSION_ID" ]; then
  # Verify session exists before resuming (avoids "No conversation found" on account switch)
  if CLAUDE_CONFIG_DIR="${CONFIG_DIR}" claude --resume "$SESSION_ID" --dangerously-skip-permissions --print-session-id 2>/dev/null | grep -q "$SESSION_ID"; then
    CLAUDE_ARGS="--resume $SESSION_ID $CLAUDE_ARGS"
    IS_RESUME=true
    echo "[evomesh] Resuming session: $SESSION_ID"
  else
    echo "[evomesh] Session $SESSION_ID not found (account changed?), starting fresh"
    rm -f "$ROLE_SESSION_FILE"
    CLAUDE_ARGS="--name ${ROLE_NAME:-role} $CLAUDE_ARGS"
  fi
else
  CLAUDE_ARGS="--name ${ROLE_NAME:-role} $CLAUDE_ARGS"
  echo "[evomesh] Starting fresh session for: ${ROLE_NAME:-role}"
fi

# Record history.jsonl line count BEFORE starting claude (shared file)
HISTORY_LINES_BEFORE=0
if [ -f "$HISTORY_FILE" ]; then
  HISTORY_LINES_BEFORE=$(wc -l < "$HISTORY_FILE" 2>/dev/null || echo 0)
fi

# Graceful shutdown (session ID saved by background task, not here)
cleanup() {
  echo "[evomesh] Shutting down..."
  tmux -f /dev/null kill-session -t claude 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

echo "[evomesh] Starting as $(whoami) (uid=$(id -u))..."

# Start claude in tmux (persists when browser disconnects)
tmux -f /dev/null new-session -d -s claude -x 120 -y 40 \
  "/usr/local/bin/claude $CLAUDE_ARGS; exec bash"
tmux -f /dev/null set-option -t claude mouse off 2>/dev/null || true

# ttyd attaches to tmux
ttyd \
  --writable \
  -t fontSize=14 \
  -t scrollback=10000 \
  -t scrollOnOutput=true \
  --port ${TTYD_PORT:-7681} \
  -- tmux -f /dev/null attach-session -t claude &
TTYD_PID=$!

# Send /loop command via tmux send-keys (much more reliable than WS)
(
  ROLE_ROOT="${ROLE_ROOT_OVERRIDE:-.evomesh/roles/${ROLE_NAME}}"
  LOOP_CMD="/loop ${LOOP_INTERVAL:-10m} You are the ${ROLE_NAME} role. FIRST: cat and read ${ROLE_ROOT}/ROLE.md completely. Then follow CLAUDE.md loop flow. Working directory: ${ROLE_ROOT}/"

  # Minimum wait: let Claude Code TUI fully initialize
  MIN_WAIT=12
  if [ "$IS_RESUME" = "true" ]; then MIN_WAIT=20; fi

  echo "[evomesh] Waiting ${MIN_WAIT}s minimum for Claude TUI to initialize..."
  sleep $MIN_WAIT

  # Then poll for the actual prompt
  READY=false
  for i in $(seq 1 60); do
    PANE=$(tmux -f /dev/null capture-pane -t claude -p 2>/dev/null || echo "")
    if echo "$PANE" | grep -q '❯'; then
      echo "[evomesh] Claude prompt confirmed after $((MIN_WAIT + i))s total"
      READY=true
      break
    fi
    sleep 1
  done

  if [ "$READY" = "true" ]; then
    sleep 2
    echo "[evomesh] Sending /loop command..."
    tmux -f /dev/null send-keys -t claude -l "$LOOP_CMD" 2>&1
    sleep 1
    tmux -f /dev/null send-keys -t claude Enter 2>&1
    echo "[evomesh] /loop command sent"
  else
    echo "[evomesh] ERROR: Claude prompt never appeared (timeout)"
  fi

  # Save session ID — only look at NEW lines in shared history.jsonl
  sleep 15
  if [ -f "$HISTORY_FILE" ]; then
    HISTORY_LINES_NOW=$(wc -l < "$HISTORY_FILE" 2>/dev/null || echo 0)
    if [ "$HISTORY_LINES_NOW" -gt "$HISTORY_LINES_BEFORE" ]; then
      # Only search new lines added since container started
      NEW_LINES=$((HISTORY_LINES_NOW - HISTORY_LINES_BEFORE))
      SID=$(tail -n "$NEW_LINES" "$HISTORY_FILE" 2>/dev/null | grep -o '"sessionId":"[^"]*"' | tail -1 | cut -d'"' -f4)
      if [ -n "$SID" ]; then
        mkdir -p "$(dirname "$ROLE_SESSION_FILE")"
        echo "$SID" > "$ROLE_SESSION_FILE"
        echo "[evomesh] Saved session: $SID"
      else
        echo "[evomesh] No new session ID found in $NEW_LINES new history lines"
      fi
    else
      echo "[evomesh] No new history lines (before=$HISTORY_LINES_BEFORE, now=$HISTORY_LINES_NOW)"
    fi
  fi
) &

wait $TTYD_PID
USEREOF
