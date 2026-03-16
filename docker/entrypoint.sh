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
# Store session ID in the project's role directory (not CLAUDE_CONFIG_DIR, which is shared)
WORK_DIR="${PWD:-/project}"
ROLE_SESSION_DIR="${WORK_DIR}/.evomesh/roles/${ROLE_NAME:-role}"
SESSION_FILE="${ROLE_SESSION_DIR}/.session-id"
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
  HISTORY="${CLAUDE_CONFIG_DIR:-$TARGET_HOME/.claude}/history.jsonl"
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

# Start ttyd in background
gosu "$TARGET_USER" ttyd \
  --writable \
  -t fontSize=14 \
  -t scrollback=10000 \
  --port 7681 \
  -- /usr/local/bin/claude $CLAUDE_ARGS &
TTYD_PID=$!

# Wait for ttyd to be ready, then send /loop command via WebSocket
(
  ROLE_ROOT=".evomesh/roles/${ROLE_NAME}"
  LOOP_CMD="/loop ${LOOP_INTERVAL:-10m} 你是 ${ROLE_NAME} 角色。执行 ${ROLE_ROOT}/ROLE.md 工作目录: ${ROLE_ROOT}/"

  # Wait for claude to be ready (check for "bypass permissions" in WS output)
  echo "[evomesh] Waiting for Claude to be ready..."
  for i in $(seq 1 60); do
    # Check if ttyd has spawned a process
    if pgrep -f "claude" > /dev/null 2>&1; then
      sleep 5  # Give claude time to fully render
      echo "[evomesh] Claude is ready. Sending /loop command..."
      # Send /loop via ttyd's WebSocket
      # Wait for claude to fully start, then connect and type the command
      sleep 10  # Give claude time to render UI
      python3 << 'PYEOF' 2>&1
import asyncio, websockets

async def send_loop():
    uri = 'ws://127.0.0.1:7681/ws'
    try:
        async with websockets.connect(uri, subprotocols=['tty']) as ws:
            # Drain any initial output
            for _ in range(10):
                try:
                    await asyncio.wait_for(ws.recv(), timeout=0.5)
                except asyncio.TimeoutError:
                    break

            # Type /loop command one char at a time
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
  HISTORY="${CLAUDE_CONFIG_DIR:-$TARGET_HOME/.claude}/history.jsonl"
  if [ -f "$HISTORY" ]; then
    SID=$(tail -1 "$HISTORY" 2>/dev/null | grep -o '"sessionId":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$SID" ]; then
      echo "$SID" > "$SESSION_FILE"
      echo "[evomesh] Saved session: $SID"
    fi
  fi
) &

# Wait for ttyd
wait $TTYD_PID
