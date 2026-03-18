---
from: user
to: lead
priority: P0
type: task
date: 2026-03-18T16:00
---

# 项目质量审计 — 审查并分派任务

## 背景

审计发现 EvoMesh 存在多个质量问题（状态一致性 bug、idle 误报、静默错误吞噬、死代码、前端 scroll 过度设计等）。请审查以下问题清单，决定优先级，分派给 core-dev 和 frontend。

## Core-dev 任务（后端）

### 1. P0: startRole/stopRole 状态一致性
- 问题：startRole 和 stopRole 中状态更新分散，异常时状态不一致
- 修复：提取 `startRoleManaged`/`stopRoleManaged` 包装函数，确保状态更新原子化，替换所有调用点

### 2. P0: Idle 检测误报
- 问题：`/idle/i` 正则太宽泛，匹配到包含 "idle" 的正常日志
- 修复：改为匹配具体 pattern `"No tasks, idle"`

### 3. P1: 静默 catch 块
- 问题：多个外层 catch 块吞噬错误，调试困难
- 修复：3 个外层 catch 加 `console.error`，内层分类处理

### 4. P1: loadConfig 缓存
- 问题：每次调用都重新解析 YAML，高频路径浪费性能
- 修复：mtime-based 缓存，文件未变时返回缓存结果

### 5. P2: 死代码清理
- 清理项：删除 restart.ts、未使用的 LOOP_PROMPT env var 引用

### 6. P2: Admin 权限修复
- 问题：routes-usage.ts 缺少 admin 权限检查
- 修复：加 admin 检查，与其他 admin route 保持一致

## Frontend 任务

### 1. P1: fetchAll 去重
- 问题：并发请求堆积，同一数据多次请求
- 修复：加请求去重机制，防止并发 fetchAll

### 2. P1: Scroll 简化
- 问题：5 个 scroll 机制互相干扰，过度设计
- 修复：精简为 3 个核心机制，移除冗余逻辑

### 3. P2: iframe 重连检测
- 问题：硬编码字符串匹配判断 iframe 状态
- 修复：替换为结构化检测方式

### 4. P2: 死代码清理
- 清理项：删除 `lastRoleStates`、`addFeedMessage` 等未使用代码

## 要求

1. Lead 审查上述清单，确认/调整优先级
2. 分派任务给 core-dev 和 frontend
3. P0 任务优先处理，P1 紧随其后
4. 各角色完成后发 ack 回 lead
5. Lead 跟踪整体进度并汇报
