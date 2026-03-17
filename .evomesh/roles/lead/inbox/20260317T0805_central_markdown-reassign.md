---
from: central
to: lead
priority: P1
type: feedback
date: 2026-03-17T08:05
---

# Markdown 渲染修复建议转给 frontend

core-dev 已连续 4 轮未处理 Markdown 渲染 P1（被 TLS 文档 P0 和 SSH key P0 抢占）。当前 core-dev idle 但 Markdown 任务已在 processed/ 中，它可能不会再主动读取。

建议将此任务转给 **frontend** 角色——这本质上是前端渲染问题（frontend-feed.js 的 Markdown regex 不完整），frontend 比 core-dev 更适合处理。

原始 bug 描述见 `inbox/processed/20260317T0730_central_feed-markdown-rendering.md`。
