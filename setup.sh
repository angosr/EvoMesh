#!/bin/bash
set -e

EVOMESH_PORT="${EVOMESH_PORT:-8123}"
WORKDIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$HOME/.evomesh/logs"

echo "=== EvoMesh Setup ==="
echo ""

# 1. Check and install prerequisites
echo "Checking prerequisites..."

# Node.js >= 18
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt 18 ]; then
    echo "ERROR: Node.js v18+ required (found $(node -v))"
    echo "  Install: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    exit 1
  fi
  echo "  Node.js: $(node -v) ✓"
else
  echo "ERROR: Node.js not found. Install v18+:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
  exit 1
fi

# Build tools (required for native modules like node-pty)
if command -v make >/dev/null 2>&1 && command -v g++ >/dev/null 2>&1; then
  echo "  Build tools: make, g++ ✓"
else
  echo "  Build tools: not found — installing build-essential..."
  if command -v apt >/dev/null 2>&1; then
    sudo apt update -qq && sudo apt install -y -qq build-essential
  elif command -v yum >/dev/null 2>&1; then
    sudo yum groupinstall -y "Development Tools"
  elif command -v brew >/dev/null 2>&1; then
    xcode-select --install 2>/dev/null || true
  else
    echo "ERROR: build tools (make, g++) required. Install manually."
    exit 1
  fi
  echo "  Build tools: installed ✓"
fi

# Docker
if command -v docker >/dev/null 2>&1; then
  echo "  Docker: $(docker -v | head -1) ✓"
else
  echo "ERROR: Docker required"
  echo "  Install: https://docs.docker.com/engine/install/"
  exit 1
fi

# tmux (required)
if command -v tmux >/dev/null 2>&1; then
  echo "  tmux: $(tmux -V) ✓"
else
  echo "  tmux: not found — installing..."
  if command -v apt >/dev/null 2>&1; then
    sudo apt update -qq && sudo apt install -y -qq tmux
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y tmux
  elif command -v brew >/dev/null 2>&1; then
    brew install tmux
  else
    echo "ERROR: tmux required. Install manually: https://github.com/tmux/tmux"
    exit 1
  fi
  echo "  tmux: $(tmux -V) ✓"
fi

# ttyd (required for terminal access)
if command -v ttyd >/dev/null 2>&1; then
  echo "  ttyd: $(ttyd --version 2>&1 | head -1) ✓"
else
  echo "  ttyd: not found — installing..."
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64)  TTYD_ARCH="x86_64" ;;
    aarch64) TTYD_ARCH="aarch64" ;;
    armv7l)  TTYD_ARCH="armhf" ;;
    *)       echo "ERROR: Unsupported arch $ARCH for ttyd auto-install. Install manually: https://github.com/tsl0922/ttyd"; exit 1 ;;
  esac
  TTYD_URL="https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.${TTYD_ARCH}"
  echo "  Downloading ttyd from $TTYD_URL ..."
  sudo curl -sL "$TTYD_URL" -o /usr/local/bin/ttyd
  sudo chmod +x /usr/local/bin/ttyd
  echo "  ttyd: $(ttyd --version 2>&1 | head -1) ✓"
fi

# Claude Code CLI + credentials
if command -v claude >/dev/null 2>&1; then
  echo "  Claude Code: $(claude --version 2>&1 | head -1) ✓"
  # Check if logged in
  if [ ! -f "$HOME/.claude/.credentials.json" ]; then
    echo ""
    echo "  ⚠ Claude Code is installed but not logged in."
    echo "  Central AI and roles need valid credentials to work."
    echo "  Run this now:"
    echo ""
    echo "    claude login"
    echo ""
    echo "  Then re-run ./setup.sh"
    echo ""
    read -r -p "  Continue without login? (y/N) " yn
    if [ "$yn" != "y" ] && [ "$yn" != "Y" ]; then
      exit 1
    fi
  else
    echo "  Claude credentials: ~/.claude/.credentials.json ✓"
  fi
else
  echo "  ERROR: Claude Code CLI not found."
  echo "  Install: npm install -g @anthropic-ai/claude-code"
  echo "  Then run: claude login"
  exit 1
fi
echo ""

# 2. Install dependencies
echo "Installing dependencies..."
if npm install; then
  echo "  Dependencies installed ✓"
else
  echo "ERROR: npm install failed"
  exit 1
fi
echo ""

# 3. Build Docker image
if docker image inspect evomesh-role >/dev/null 2>&1; then
  echo "Docker image (evomesh-role) already exists. Rebuild? (y/N)"
  read -r yn
  if [ "$yn" = "y" ] || [ "$yn" = "Y" ]; then
    docker build -q -t evomesh-role docker/
    echo "  Docker image rebuilt ✓"
  else
    echo "  Skipped docker build ✓"
  fi
else
  echo "Building Docker image (evomesh-role)..."
  docker build -q -t evomesh-role docker/
  echo "  Docker image built ✓"
fi
echo ""

# 4. Prepare log directory
mkdir -p "$LOG_DIR"

# 5. Install systemd service and start (or fallback to nohup)
USE_SYSTEMD=false

if command -v systemctl >/dev/null 2>&1; then
  echo "systemd detected. Install as system service for auto-start on boot? (Y/n)"
  read -r yn
  if [ "$yn" != "n" ] && [ "$yn" != "N" ]; then
    USE_SYSTEMD=true
  fi
fi

if [ "$USE_SYSTEMD" = true ]; then
  echo "Installing systemd service..."

  # Resolve real paths for node
  NODE_BIN="$(command -v node)"
  NODE_DIR="$(dirname "$NODE_BIN")"

  # Generate service file from template
  sed \
    -e "s|__WORKDIR__|${WORKDIR}|g" \
    -e "s|__USER__|$(whoami)|g" \
    -e "s|__NODE_BIN__|${NODE_BIN}|g" \
    -e "s|__NODE_DIR__|${NODE_DIR}|g" \
    -e "s|__PORT__|${EVOMESH_PORT}|g" \
    -e "s|__HOME__|${HOME}|g" \
    -e "s|__LOG_DIR__|${LOG_DIR}|g" \
    deploy/evomesh.service > /tmp/evomesh.service

  sudo cp /tmp/evomesh.service /etc/systemd/system/evomesh.service
  rm -f /tmp/evomesh.service
  sudo systemctl daemon-reload
  sudo systemctl enable evomesh

  # Stop old instance if running (nohup or previous systemd)
  sudo systemctl stop evomesh 2>/dev/null || true
  pkill -f "tsx.*bin/evomesh.ts serve" 2>/dev/null || true
  sleep 1

  sudo systemctl start evomesh
  sleep 3

  if systemctl is-active --quiet evomesh; then
    echo ""
    echo "=== EvoMesh is running (systemd) ==="
    echo ""
    echo "  Web UI:      http://localhost:${EVOMESH_PORT}"
    echo "  Logs:        journalctl -u evomesh -f"
    echo "               ${LOG_DIR}/evomesh.log"
    echo "  Auto-start:  enabled (on boot)"
    echo "  Auto-reload: enabled (watches src/ for changes)"
    echo ""
    echo "  Management:"
    echo "    sudo systemctl status evomesh   # check status"
    echo "    sudo systemctl restart evomesh  # manual restart"
    echo "    sudo systemctl stop evomesh     # stop server"
    echo "    sudo systemctl disable evomesh  # disable auto-start"
    echo ""
  else
    echo "ERROR: systemd service failed to start."
    echo "  Check: journalctl -u evomesh -n 50 --no-pager"
    exit 1
  fi
else
  # Fallback: nohup (no boot auto-start)
  echo "Starting EvoMesh server (nohup)..."

  # Kill any existing instance
  pkill -f "tsx.*bin/evomesh.ts serve" 2>/dev/null || true
  sleep 1

  nohup npx tsx --watch --watch-path=src bin/evomesh.ts serve --port "$EVOMESH_PORT" >> "$LOG_DIR/evomesh.log" 2>&1 &
  SERVER_PID=$!
  sleep 3

  if kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "=== EvoMesh is running (nohup) ==="
    echo ""
    echo "  Web UI:      http://localhost:${EVOMESH_PORT}"
    echo "  Logs:        ${LOG_DIR}/evomesh.log"
    echo "  PID:         ${SERVER_PID}"
    echo "  Auto-reload: enabled (watches src/ for changes)"
    echo ""
    echo "  NOTE: nohup mode — server will NOT auto-start on reboot."
    echo "  Re-run ./setup.sh and choose systemd to enable boot auto-start."
    echo ""
  else
    echo "ERROR: Server failed to start. Check ${LOG_DIR}/evomesh.log"
    exit 1
  fi
fi

echo "  First visit: create admin account at /login"
echo "  Then use Central AI to add your project"
echo ""
echo "  No public IP? Use a tunnel:"
echo "    cloudflared tunnel --url http://localhost:${EVOMESH_PORT}"
echo "    # or: ngrok http ${EVOMESH_PORT}"
echo ""
