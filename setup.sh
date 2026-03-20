#!/bin/bash
set -e

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

# Claude Code CLI
if command -v claude >/dev/null 2>&1; then
  echo "  Claude Code: $(claude --version 2>&1 | head -1) ✓"
else
  echo "  WARNING: Claude Code CLI not found. Install: npm install -g @anthropic-ai/claude-code"
  echo "  EvoMesh will start but roles won't work without Claude Code."
fi
echo ""

# 2. Install dependencies
echo "Installing dependencies..."
npm install --silent
echo ""

# 3. Build Docker image
echo "Building Docker image (evomesh-role)..."
docker build -t evomesh-role docker/
echo ""

# 4. Install systemd service (optional)
if command -v systemctl >/dev/null 2>&1 && [ -f deploy/evomesh.service ]; then
  echo "systemd detected. Install service? (y/N)"
  read -r yn
  if [ "$yn" = "y" ] || [ "$yn" = "Y" ]; then
    sudo cp deploy/evomesh.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable evomesh
    echo "  systemd service installed and enabled"
  fi
  echo ""
fi

# 5. Start server
echo "Starting EvoMesh server..."
nohup npx tsx --watch --watch-path=src bin/evomesh.ts serve --port 8123 > /tmp/evomesh.log 2>&1 &
SERVER_PID=$!
sleep 3

if kill -0 $SERVER_PID 2>/dev/null; then
  echo ""
  echo "=== EvoMesh is running ==="
  echo ""
  echo "  Web UI: http://localhost:8123"
  echo "  Logs:   /tmp/evomesh.log"
  echo "  PID:    $SERVER_PID"
  echo ""
  echo "  First visit: create admin account at /login"
  echo "  Then use Central AI to add your project"
  echo ""
  echo "  No public IP? Use a tunnel:"
  echo "    cloudflared tunnel --url http://localhost:8123"
  echo "    # or: ngrok http 8123"
  echo ""
else
  echo "ERROR: Server failed to start. Check /tmp/evomesh.log"
  exit 1
fi
