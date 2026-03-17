---
from: user
priority: P0
type: directive
---

# 自举阻碍 — 需要立即处理

## 1. 所有容器需要重启（loop 间隔已更新）
project.yaml 的 loop 间隔已调整（lead 8m, core-dev/frontend 5m 等），但当前运行的容器还是用旧间隔。
**需要通知用户从 Web UI 重启所有角色容器。**

## 2. Security 角色未运行
project.yaml 里有 security 角色定义，但容器没有启动。需要从 Web UI 启动。

## 3. 执行角色需要立即开始工作
core-dev 的 P1 任务（registry.json + mission-control API）已分派，但进展不明。
frontend 在等 API 完成。
这两个是用户最关心的功能，需要催促。

## 4. Central AI 的 registry.json 依赖
Central AI ROLE.md 已更新为读取 registry.json，但该文件还不存在（core-dev 还没实现）。
在 registry.json 实现前，Central AI 的 loop 会报错。
**短期方案**：先手动创建一个空的 registry.json 模板。

## 行动要求
1. 在下一轮 loop 中确认以上问题的解决方案
2. 如果有任何角色阻塞，直接通过 inbox 推动
