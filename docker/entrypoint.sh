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
ROLE_SESSION_FILE="${WORK_DIR}/.evomesh/roles/${ROLE_NAME:-role}/.session-id"
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
  CLAUDE_ARGS="--resume $SESSION_ID $CLAUDE_ARGS"
  IS_RESUME=true
  echo "[evomesh] Resuming session: $SESSION_ID"
else
  CLAUDE_ARGS="--name ${ROLE_NAME:-role} $CLAUDE_ARGS"
  echo "[evomesh] Starting fresh session for: ${ROLE_NAME:-role}"
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

# Send /loop command for fresh sessions
(
  ROLE_ROOT=".evomesh/roles/${ROLE_NAME}"
  LOOP_CMD="/loop ${LOOP_INTERVAL:-10m} 你是 ${ROLE_NAME} 角色。执行 ${ROLE_ROOT}/ROLE.md 工作目录: ${ROLE_ROOT}/"

  WAIT_TIME=15
  if [ "$IS_RESUME" = "true" ]; then WAIT_TIME=25; fi

  echo "[evomesh] Waiting for Claude to be ready..."
  for i in $(seq 1 60); do
    if pgrep -f "claude" > /dev/null 2>&1; then
      echo "[evomesh] Claude process found. Waiting ${WAIT_TIME}s..."
      sleep $WAIT_TIME
      echo "[evomesh] Sending /loop command..."
      export EVOMESH_TTYD_PORT="${TTYD_PORT:-7681}"
      python3 << 'PYEOF' 2>&1
import asyncio, websockets, os

async def send_loop():
    port = os.environ.get('EVOMESH_TTYD_PORT', '7681')
    uri = f'ws://127.0.0.1:{port}/ws'
    try:
        async with websockets.connect(uri, subprotocols=['tty']) as ws:
            for _ in range(10):
                try:
                    await asyncio.wait_for(ws.recv(), timeout=0.5)
                except asyncio.TimeoutError:
                    break
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

  # Save session ID
  sleep 10
  if [ -f "$HISTORY_FILE" ]; then
    SID=$(tail -1 "$HISTORY_FILE" 2>/dev/null | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$SID" ]; then
      mkdir -p "$(dirname "$ROLE_SESSION_FILE")"
      echo "$SID" > "$ROLE_SESSION_FILE"
      echo "[evomesh] Saved session: $SID"
    fi
  fi
) &

wait $TTYD_PID
USEREOF
