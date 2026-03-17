---
from: user
priority: P0
type: task
date: 2026-03-17T00:50
---

# 右侧面板重大修改

## 问题
1. Central AI Status 同时作为 tab 和出现在 Activity 下方 — 重复
2. Issues 和 Tasks 里已完成的项会堆积 — 需要自动清理
3. Activity 里的角色 online/offline 信息和 Central AI Status 里的重复

## 修改要求

### 1. 去掉 Central AI Status 作为独立 tab
- 删除 "Central AI" tab
- Central AI 的汇报内容整合到 Activity tab 里（作为置顶区域或第一条）
- 保留 Central AI 输入框在底部（所有 tab 都可见）

### 2. Issues 自动清理
- 只显示当前存在的问题（每次刷新重新计算）
- 已解决的不保留

### 3. Tasks 自动清理
- 只显示 todo.md 里未完成（⬜）的任务
- 已完成（✅ 或 ~~删除线~~）的不显示

### 4. Activity 精简
- 每个角色只显示 1 条最新动态
- 不显示 "running/stopped" 状态（这是 Issues 的职责）
- 显示实际做了什么（从 memory/short-term.md 提取）
