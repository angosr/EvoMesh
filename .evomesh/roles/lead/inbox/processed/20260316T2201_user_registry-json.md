---
from: user
priority: P0
type: feature
---

# 任务二：registry.json — 角色运行状态注册表

## 现状问题
Central AI 启动时完全不知道哪些角色在运行。它没有 Docker 访问权限，无法执行 `docker ps`。这是根本性设计缺陷。

## 目标
Server 定时写入 `~/.evomesh/registry.json`，记录所有角色的运行状态。Central AI 和其他需要全局视图的组件读取此文件。

## 设计方案

### Server 端（core-dev 负责）
- Server 每 15 秒写入 `~/.evomesh/registry.json`
- 内容结构：
```json
{
  "timestamp": "2026-03-16T22:00:00Z",
  "server": { "port": 8123, "pid": 12345 },
  "projects": {
    "evomesh": {
      "path": "/home/user/work/EvoMesh",
      "roles": {
        "lead": { "running": true, "port": 8224, "container": "evomesh-evomesh-lead" },
        "core-dev": { "running": true, "port": 8226, "container": "evomesh-evomesh-core-dev" },
        "reviewer": { "running": false }
      }
    }
  },
  "central": { "running": true, "port": 8223 }
}
```
- 数据来源：遍历 workspace.yaml 的项目，对每个角色调用 `getContainerState()`
- 写入时用原子写（写临时文件再 rename）防止读到半写数据

### Central AI ROLE.md 已更新
- 步骤 4 已改为：读取 `~/.evomesh/registry.json`
- 如果文件不存在或超过 60 秒未更新，判断 Server 可能未运行

### Mission Control 面板也依赖此数据
- `/api/mission-control` 可直接读 registry.json 或共享内存中的状态

## 分派建议
- core-dev 负责 Server 端定时写入逻辑
- Central AI ROLE.md 已由用户更新完成，无需额外工作
