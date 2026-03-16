---
from: user
priority: P0
type: task
date: 2026-03-16T23:15
---

# 实现 /api/mission-control — Server 实时聚合角色数据

## 背景
右侧面板目前只读 Central AI 的 central-status.md，内容过时且信息少。
需要 Server 直接从文件系统聚合所有角色的实时数据。

## 实现

### API: GET /api/mission-control
Server 扫描所有项目的角色文件，返回：

```json
{
  "activity": [
    { "project": "EvoMesh", "role": "core-dev", "time": "2min ago", "text": "Fixed 3 security issues" },
    { "project": "EvoMesh", "role": "security", "time": "5min ago", "text": "Completed initial audit" }
  ],
  "issues": [
    { "project": "EvoMesh", "role": "security", "type": "stopped", "text": "Container not running" },
    { "project": "EvoMesh", "role": "lead", "type": "stale", "text": "Memory 6h outdated" }
  ],
  "tasks": [
    { "project": "EvoMesh", "role": "core-dev", "priority": "P1", "text": "Implement registry.json" }
  ]
}
```

### 数据来源（全部文件读取，无需 Docker 调用）

**activity**: 读每个角色的 `memory/short-term.md`，提取最近一轮 "Done" 行。按文件修改时间排序。

**issues**:
- 检查角色容器状态（`getContainerState()`）
- memory 超过 1 小时未更新 → "stale"
- todo.md 有 P0 未完成 → "p0-pending"

**tasks**: 读每个角色的 `todo.md`，提取未完成的 `⬜` 行，解析优先级。

### 性能
- 文件读取很快，不需要缓存
- 前端 5 秒轮询一次即可

### 注意
- 遍历 workspace.yaml 的所有项目
- 每个项目遍历 project.yaml 的所有角色
- 错误容忍：文件不存在就跳过
