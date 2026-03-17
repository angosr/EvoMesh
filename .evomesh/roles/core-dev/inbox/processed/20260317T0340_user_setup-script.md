---
from: user
priority: P1
type: task
date: 2026-03-17T03:40
---

# 创建 setup.sh 一键部署脚本

## 目的
新机器部署 EvoMesh 只需要：`git clone` + `./setup.sh`

## 脚本内容

```bash
#!/bin/bash
set -e

echo "=== EvoMesh Setup ==="

# 1. Check prerequisites
command -v node >/dev/null || { echo "ERROR: Node.js required"; exit 1; }
command -v docker >/dev/null || { echo "ERROR: Docker required"; exit 1; }
command -v tmux >/dev/null || { echo "WARNING: tmux needed for host mode"; }
command -v ttyd >/dev/null || { echo "WARNING: ttyd needed for host mode"; }

# 2. Install dependencies
npm install

# 3. Build Docker image
echo "Building Docker image..."
docker build -t evomesh-role docker/

# 4. Install systemd service (if systemd available)
if command -v systemctl >/dev/null; then
  sudo cp deploy/evomesh.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable evomesh
  echo "systemd service installed"
fi

# 5. Start server (bootstrap.ts will create ~/.evomesh/)
echo "Starting server..."
npx tsx --watch --watch-path=src bin/evomesh.ts serve --port 8123 &

echo ""
echo "EvoMesh running at http://localhost:8123"
echo "First visit: create admin account"
echo "Then tell Central AI to add your project"
```

放到项目根目录 `setup.sh`，chmod +x。
README.md 也需要更新安装说明指向 setup.sh。
