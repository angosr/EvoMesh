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
export EVOMESH_CONTAINER=1

# Provider detection — supports claude (default) and codex
PROVIDER="${EVOMESH_PROVIDER:-claude}"
WORK_DIR="${PWD:-/project}"
ROLE_SESSION_DIR="${ROLE_ROOT_OVERRIDE:-.evomesh/roles/${ROLE_NAME:-role}}"
ROLE_SESSION_FILE="${WORK_DIR}/${ROLE_SESSION_DIR}/.session-id"

# Provider-specific setup
if [ "$PROVIDER" = "codex" ]; then
  CLI_BIN=$(which codex 2>/dev/null || echo "/usr/local/bin/codex")
  CONFIG_DIR="${CODEX_HOME:-$HOME/.codex}"
  CLI_ARGS="--dangerously-bypass-approvals-and-sandbox"
  if [ -n "$CLI_MODEL" ]; then
    CLI_ARGS="--model $CLI_MODEL $CLI_ARGS"
  fi
  # Codex resume
  SESSION_ID=""
  IS_RESUME=false
  if [ -f "$ROLE_SESSION_FILE" ] && [ -s "$ROLE_SESSION_FILE" ]; then
    SESSION_ID=$(cat "$ROLE_SESSION_FILE")
    CLI_ARGS="resume $SESSION_ID $CLI_ARGS"
    IS_RESUME=true
    echo "[evomesh] Resuming codex session: $SESSION_ID"
  else
    echo "[evomesh] Starting fresh codex session for: ${ROLE_NAME:-role}"
  fi
  HISTORY_FILE=""
  HISTORY_LINES_BEFORE=0
else
  # Claude Code (default)
  CLI_BIN=$(which claude 2>/dev/null || echo "/usr/local/bin/claude")
  CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
  HISTORY_FILE="${CONFIG_DIR}/history.jsonl"
  CLI_ARGS="--dangerously-skip-permissions"
  if [ -n "$CLI_MODEL" ]; then
    CLI_ARGS="--model $CLI_MODEL $CLI_ARGS"
  fi
  SESSION_ID=""
  if [ -f "$ROLE_SESSION_FILE" ] && [ -s "$ROLE_SESSION_FILE" ]; then
    SESSION_ID=$(cat "$ROLE_SESSION_FILE")
    echo "[evomesh] Found saved session: $SESSION_ID"
  fi
  IS_RESUME=false
  if [ -n "$SESSION_ID" ]; then
    if CLAUDE_CONFIG_DIR="${CONFIG_DIR}" "$CLI_BIN" --resume "$SESSION_ID" --dangerously-skip-permissions --print-session-id 2>/dev/null | grep -q "$SESSION_ID"; then
      CLI_ARGS="--resume $SESSION_ID $CLI_ARGS"
      IS_RESUME=true
      echo "[evomesh] Resuming session: $SESSION_ID"
    else
      echo "[evomesh] Session $SESSION_ID not found, starting fresh"
      rm -f "$ROLE_SESSION_FILE"
      CLI_ARGS="--name ${ROLE_NAME:-role} $CLI_ARGS"
    fi
  else
    CLI_ARGS="--name ${ROLE_NAME:-role} $CLI_ARGS"
    echo "[evomesh] Starting fresh session for: ${ROLE_NAME:-role}"
  fi
  HISTORY_LINES_BEFORE=0
  if [ -n "$HISTORY_FILE" ] && [ -f "$HISTORY_FILE" ]; then
    HISTORY_LINES_BEFORE=$(wc -l < "$HISTORY_FILE" 2>/dev/null || echo 0)
  fi
fi

# Graceful shutdown
cleanup() {
  echo "[evomesh] Shutting down..."
  tmux -f /dev/null kill-session -t claude 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

echo "[evomesh] Starting as $(whoami) (uid=$(id -u)) provider=$PROVIDER..."

ROLE_ROOT="${ROLE_ROOT_OVERRIDE:-.evomesh/roles/${ROLE_NAME}}"
LOOP_SECONDS=$(echo "${LOOP_INTERVAL:-10m}" | sed 's/m/*60/' | sed 's/h/*3600/' | bc 2>/dev/null || echo 600)

# Start CLI in tmux (persists when browser disconnects)
tmux -f /dev/null new-session -d -s claude -x 120 -y 40 \
  "$CLI_BIN $CLI_ARGS; exec bash"
tmux -f /dev/null set-option -t claude mouse off 2>/dev/null || true

# ttyd attaches to tmux (same for both providers)
ttyd \
  --writable \
  --ping-interval 30 \
  -t fontSize=14 \
  -t scrollback=10000 \
  -t scrollOnOutput=true \
  --port ${TTYD_PORT:-7681} \
  -- tmux -f /dev/null attach-session -t claude &
TTYD_PID=$!

if [ "$PROVIDER" != "codex" ]; then
  # Claude-specific: send /loop command + save session ID
  (
    LOOP_CMD="/loop ${LOOP_INTERVAL:-10m} You are the ${ROLE_NAME} role. FIRST: cat and read ${ROLE_ROOT}/ROLE.md completely. Then follow CLAUDE.md loop flow. Working directory: ${ROLE_ROOT}/"

    MIN_WAIT=12
    if [ "$IS_RESUME" = "true" ]; then MIN_WAIT=20; fi

    echo "[evomesh] Waiting ${MIN_WAIT}s minimum for Claude TUI to initialize..."
    sleep $MIN_WAIT

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

    # Save session ID
    sleep 15
    if [ -n "$HISTORY_FILE" ] && [ -f "$HISTORY_FILE" ]; then
      HISTORY_LINES_NOW=$(wc -l < "$HISTORY_FILE" 2>/dev/null || echo 0)
      if [ "$HISTORY_LINES_NOW" -gt "$HISTORY_LINES_BEFORE" ]; then
        NEW_LINES=$((HISTORY_LINES_NOW - HISTORY_LINES_BEFORE))
        SID=$(tail -n "$NEW_LINES" "$HISTORY_FILE" 2>/dev/null | grep -o '"sessionId":"[^"]*"' | tail -1 | cut -d'"' -f4)
        if [ -n "$SID" ]; then
          mkdir -p "$(dirname "$ROLE_SESSION_FILE")"
          echo "$SID" > "$ROLE_SESSION_FILE"
          echo "[evomesh] Saved session: $SID"
        fi
      fi
    fi
  ) &
fi

wait $TTYD_PID
USEREOF
