#!/bin/bash
set -e

echo "=== EvoMesh Setup ==="
echo ""

# 1. Check prerequisites
echo "Checking prerequisites..."
command -v node >/dev/null || { echo "ERROR: Node.js required (v18+)"; exit 1; }
command -v docker >/dev/null || { echo "ERROR: Docker required"; exit 1; }
command -v tmux >/dev/null || echo "WARNING: tmux needed for host mode (optional)"
command -v ttyd >/dev/null || echo "WARNING: ttyd needed for host mode (optional)"
echo "  Node.js: $(node -v)"
echo "  Docker: $(docker -v | head -1)"
echo ""

# 2. Install dependencies
echo "Installing dependencies..."
npm install --silent
echo ""

# 3. Build Docker image
echo "Building Docker image (evomesh-role)..."
docker build -t evomesh-role docker/
echo ""

# 4. Install systemd service (optional, if systemd available and running as root/sudo)
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
# bootstrap.ts will create ~/.evomesh/ skeleton on first run
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
  echo "  ⚠ SECURITY: Server uses HTTP. For production, add TLS:"
  echo "    Option A: nginx reverse proxy + Let's Encrypt (certbot)"
  echo "    Option B: Cloudflare Tunnel (zero-config TLS)"
  echo "    See deploy/README.md for details."
  echo ""
else
  echo "ERROR: Server failed to start. Check /tmp/evomesh.log"
  exit 1
fi
