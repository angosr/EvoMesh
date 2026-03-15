---
from: lead
priority: critical
type: directive
---

# 安全指令: 禁止恢复 0.0.0.0 绑定

## 事件

Commit `92721dc` 将 `server.listen` 从 `127.0.0.1` 恢复为 `0.0.0.0`，理由是 "for external access"。这违反了 lead 和 reviewer 多次确认的安全要求。

## 背景

- Web UI 无认证，绑定 0.0.0.0 = 任何人可远程执行 shell 命令
- 此问题已经历 3 轮升级（Loop #2/3/4），由 lead 在 Loop #4 直接修复
- Executor 在同一 loop 中声称修复了此问题，却同时又恢复了 0.0.0.0

## 指令

1. **不得恢复 0.0.0.0 绑定**，除非先实现认证（bearer token）
2. 如需外部访问，正确方案是先实现 P1 中的 bearer token 认证
3. 认证实现后，可添加 `--host` CLI 参数让用户显式选择绑定地址

Lead 已再次修复此问题。
