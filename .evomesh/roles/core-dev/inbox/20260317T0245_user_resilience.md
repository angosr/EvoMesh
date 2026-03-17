---
from: user
priority: P1
type: task
date: 2026-03-17T02:45
---

# 三层容灾保障

## 1. 宿主机重启后自动恢复
Server 进程需要开机自启。两种方案任选：

**方案 A：systemd unit**
```ini
[Unit]
Description=EvoMesh Server
After=docker.service

[Service]
WorkingDirectory=/home/user/work/EvoMesh
ExecStart=/usr/bin/npx tsx --watch --watch-path=src bin/evomesh.ts serve --port 8123
Restart=always
User=claudeuser

[Install]
WantedBy=multi-user.target
```

**方案 B：在 package.json 加 start 脚本 + crontab @reboot**
```
@reboot cd /home/user/work/EvoMesh && npx tsx --watch --watch-path=src bin/evomesh.ts serve --port 8123 &
```

Server 启动时 `ensureCentralAI()` 已经会自动启动 Central AI（host tmux）。
Docker 容器加 `--restart=unless-stopped` 到 `startRole()` 的 docker args 里。

## 2. 账号掉线 → Central AI 提醒
Central AI ROLE.md 的 loop flow 里加一步：
- 每轮检测 registry.json 中角色状态
- 如果多个角色同时变为 not-running → 可能是账号问题
- 写入 central-status.md 的"需要用户关注"区域

这个不需要代码改动，只需要 Central AI 的 ROLE.md 加一条规则。

## 3. Central AI 掉线 → Server 预警
Server 的 15s 扫描循环检测 Central AI tmux session：
- 如果 Central AI 不在 running → 尝试重建（ensureCentralAI 已有此逻辑）
- 如果连续 3 次重建失败 → 在 registry.json 里标记 `central.error: true`
- 前端读 registry 发现 error → 页面顶部显示红色告警条
