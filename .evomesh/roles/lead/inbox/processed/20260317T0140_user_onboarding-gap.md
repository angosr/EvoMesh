---
from: user
priority: P1
type: design-issue
date: 2026-03-17T01:40
---

# 新用户 onboarding 体验断裂

## 问题
新用户安装后的第一个动作是"添加项目"。但：
1. Web UI 没有添加项目按钮（只能通过 Central AI）
2. Central AI 在容器里，响应慢（几分钟）
3. 用户的第一次体验 = 等待

对比竞品 CrewAI：5 行代码立刻跑起来。

## 这不是要求加回 Web UI 的添加按钮

而是要求 **Central AI 的响应速度** 必须达到用户可接受的水平。
dual launch mode（host 模式）是解决方案之一。
但更重要的是：Central AI 收到 inbox 后应该 **立即处理**，不是等下一轮 loop。

## 建议
研究：能否让 Central AI 在收到新 inbox 文件时立即被唤醒（file watcher / inotify trigger），而不是依赖固定间隔的 /loop？
或者：Server 收到用户消息后，直接通过 tmux send-keys 发给 Central AI 而不只是写文件。
（当前 routes-admin.ts 的 /api/admin/message 已经同时写文件和 tmux send-keys，但 Central AI 可能不处理）

分派给 agent-architect 研究即时响应方案。
