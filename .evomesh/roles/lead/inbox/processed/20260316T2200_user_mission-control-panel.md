---
from: user
priority: P0
type: feature
---

# 任务一：右侧面板重新设计 — Mission Control

## 现状问题
右侧面板只是读取 `central-status.md` 显示一段静态文字，完全无法产生生产力。Central AI 每 5-10 分钟才写一次文件，信息严重滞后。

## 目标
右侧面板由 **Server 直接聚合所有角色的实时数据**，不依赖 Central AI。

## 设计方案

### 1. 实时活动流 (Activity Feed)
- Server 每 5 秒读取所有角色的 `memory/short-term.md`
- diff 检测变化，推送最新动态到前端
- 格式：`[角色名] 时间 — 最新状态`
- 需覆盖多个项目、多个角色

### 2. 问题/告警 (Issues)
- Server 自动检测：角色停止运行、todo.md 有 P0 未处理、长时间无输出
- 每条告警带操作按钮（重启 / 查看日志 / 查看 todo）

### 3. 任务总览 (Tasks)
- 聚合所有角色的 `todo.md`，按优先级排列
- 显示：任务描述 + 所属角色 + 项目

### 4. 指令区 (Command)
- 保留输入框，发送到 Central AI inbox
- 不需要「全部启动/全部停止」按钮

## 技术要点
- Server 新增 API：`/api/mission-control` 返回聚合数据
- 前端 5 秒轮询或 SSE 推送
- 需支持多项目多角色
- Central AI 状态仍显示但降级为一个小区域

## 分派建议
- frontend 角色负责前端实现
- core-dev 角色负责 Server API
