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
# Session ID stored in project's role directory (unique per role, not shared)
WORK_DIR="${PWD:-/project}"
ROLE_SESSION_FILE="${WORK_DIR}/.evomesh/roles/${ROLE_NAME:-role}/.session-id"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$TARGET_HOME/.claude}"
HISTORY_FILE="${CONFIG_DIR}/history.jsonl"
CLAUDE_ARGS="--dangerously-skip-permissions"

# Try to find session ID for this role
SESSION_ID=""
if [ -f "$ROLE_SESSION_FILE" ] && [ -s "$ROLE_SESSION_FILE" ]; then
  SESSION_ID=$(cat "$ROLE_SESSION_FILE")
  echo "[evomesh] Found saved session: $SESSION_ID"
fi

# If no saved ID, search history.jsonl for this role's last session
if [ -z "$SESSION_ID" ] && [ -f "$HISTORY_FILE" ]; then
  SESSION_ID=$(grep "${ROLE_NAME:-role}" "$HISTORY_FILE" 2>/dev/null | tail -1 | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
  if [ -n "$SESSION_ID" ]; then
    echo "[evomesh] Found session from history: $SESSION_ID"
  fi
fi

IS_RESUME=false
if [ -n "$SESSION_ID" ]; then
  CLAUDE_ARGS="--resume $SESSION_ID $CLAUDE_ARGS"
  IS_RESUME=true
  echo "[evomesh] Resuming session: $SESSION_ID"
else
  CLAUDE_ARGS="--name ${ROLE_NAME:-role} $CLAUDE_ARGS"
  echo "[evomesh] Starting fresh session for: ${ROLE_NAME:-role}"
fi

# Graceful shutdown — save session ID
cleanup() {
  echo "[evomesh] Shutting down..."
  # Extract this role's session ID from history (search by role name)
  if [ -f "$HISTORY_FILE" ]; then
    SID=$(grep "${ROLE_NAME:-role}" "$HISTORY_FILE" 2>/dev/null | tail -1 | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$SID" ]; then
      mkdir -p "$(dirname "$ROLE_SESSION_FILE")"
      echo "$SID" > "$ROLE_SESSION_FILE"
      echo "[evomesh] Saved session: $SID"
    fi
  fi
  kill -TERM $(pgrep -f "claude" 2>/dev/null) 2>/dev/null || true
  wait
  exit 0
}
trap cleanup SIGTERM SIGINT

echo "[evomesh] Starting as $TARGET_USER (uid=$TARGET_UID)..."

# Start claude inside tmux (persists when browser disconnects)
gosu "$TARGET_USER" tmux new-session -d -s claude -x 120 -y 40 \
  "/usr/local/bin/claude $CLAUDE_ARGS; exec bash"

# tmux mouse OFF: allows text selection + long-press copy on mobile
# Scroll: desktop wheel via xterm.js, mobile touch via API scroll endpoint
gosu "$TARGET_USER" tmux set-option -t claude mouse off 2>/dev/null || true

# ttyd attaches to tmux session (browser disconnect won't kill claude)
gosu "$TARGET_USER" ttyd \
  --writable \
  -t fontSize=14 \
  -t scrollback=10000 \
  -t scrollOnOutput=true \
  --port 7681 \
  -- tmux attach-session -t claude &
TTYD_PID=$!

# Wait for claude to start, then send /loop command
(
  ROLE_ROOT=".evomesh/roles/${ROLE_NAME}"
  LOOP_CMD="/loop ${LOOP_INTERVAL:-10m} 你是 ${ROLE_NAME} 角色。执行 ${ROLE_ROOT}/ROLE.md 工作目录: ${ROLE_ROOT}/"

  # Always send /loop — cron jobs don't persist across session restarts
  WAIT_TIME=15
  if [ "$IS_RESUME" = "true" ]; then WAIT_TIME=25; fi

  echo "[evomesh] Waiting for Claude to be ready..."
  for i in $(seq 1 60); do
    if pgrep -f "claude" > /dev/null 2>&1; then
      echo "[evomesh] Claude process found. Waiting ${WAIT_TIME}s for UI to be ready..."
      sleep $WAIT_TIME
      echo "[evomesh] Claude is ready. Sending /loop command..."
      python3 << 'PYEOF' 2>&1
import asyncio, websockets

async def send_loop():
    uri = 'ws://127.0.0.1:7681/ws'
    try:
        async with websockets.connect(uri, subprotocols=['tty']) as ws:
            # Drain initial output
            for _ in range(10):
                try:
                    await asyncio.wait_for(ws.recv(), timeout=0.5)
                except asyncio.TimeoutError:
                    break
            # Type /loop command
            cmd = "$LOOP_CMD" + "\r"
            for ch in cmd:
                await ws.send(bytes([0]) + ch.encode('utf-8'))
                await asyncio.sleep(0.02)
            await asyncio.sleep(2)
            print('[evomesh] /loop command sent')
    except Exception as e:
        print(f'[evomesh] WS error: {e}')

asyncio.run(send_loop())
PYEOF
      break
    fi
    sleep 1
  done

  # Save session ID after loop starts
  sleep 10
  if [ -f "$HISTORY_FILE" ]; then
    SID=$(grep "${ROLE_NAME}" "$HISTORY_FILE" 2>/dev/null | tail -1 | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$SID" ]; then
      mkdir -p "$(dirname "$ROLE_SESSION_FILE")"
      echo "$SID" > "$ROLE_SESSION_FILE"
      echo "[evomesh] Saved session: $SID"
    fi
  fi
) &

# Wait for ttyd
wait $TTYD_PID
