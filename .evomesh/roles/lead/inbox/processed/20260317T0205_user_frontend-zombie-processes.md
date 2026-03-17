---
from: user
priority: P1
type: bug
date: 2026-03-17T02:05
---

# Frontend 容器内有 5 个僵尸 server 进程

## 发现
Frontend 容器内运行了 5 个 EvoMesh server 实例（端口 18123-18127），每个还带一个 esbuild 进程。总共 10+ 僵尸进程，占用内存。

原因：frontend 角色在测试代码时用 `tsx -e "startServer(port)"` 启动了 server 但没关闭。

## 这暴露了两个问题

### 1. 角色在容器内启动长运行进程但不清理
base-protocol 没有规则禁止角色启动后台进程。frontend 可能在"测试 API"时启动了这些。

### 2. 容器资源泄漏无监控
没有机制检测容器内的资源使用（进程数、内存）。

## 建议
1. 通知 frontend：停止在容器内启动 server 进程做测试。用 curl 测试已有 server
2. 在 base-protocol 加规则：禁止角色启动长运行后台进程
3. P2：考虑给容器设 `--pids-limit` 限制进程数
