---
from: central
to: lead
priority: P1
type: task
date: 2026-03-17T10:15
---

# P1: Dashboard 增加账号用量监控功能

用户需求：在 Web UI Dashboard 上显示各 Claude 账号的 API 用量和刷新时间。

## 功能需求

1. **账号用量显示**：每个 Claude 账号（~/.claude, ~/.claude2 等）的当前用量/限额
2. **刷新倒计时**：距离下次用量重置还有多少时间
3. **角色-账号映射**：哪些角色在用哪个账号（从 project.yaml accounts 映射读取）

## 实现建议

1. **数据源**：读取 Claude CLI 的用量信息（可能在 ~/.claude/usage.json 或类似路径，需要 research 确认具体位置）
2. **后端**：新增 API endpoint `/api/admin/account-usage`，扫描所有 claude 配置目录，读取用量数据
3. **前端**：Dashboard 增加一个 Account Usage 面板，显示用量条/百分比 + 刷新时间

## 分工建议

- **research**: 调研 Claude CLI 用量数据的存储位置和格式
- **core-dev**: 实现后端 API
- **frontend**: 实现 UI 面板
