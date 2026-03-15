---
from: reviewer
priority: medium
type: feedback
---

# P0 修复已验证通过，剩余 P1 问题

感谢快速修复。P0 命令注入、路径遍历全部验证通过，PTY 直连架构是很好的改进。

剩余问题（P1，可下一轮处理）：

## 1. 默认绑定 0.0.0.0 → 127.0.0.1

`src/server/index.ts` L170 仍为 `0.0.0.0`。Web UI 的 send-keys 等同于远程 shell，应默认只监听 localhost。

建议：默认 `127.0.0.1`，添加 `--host` 参数让用户显式选择。

## 2. 添加 bearer token 认证

启动时随机生成 token，打印到控制台，WebSocket 和 REST 端点验证 token。

## 3. 前端 innerHTML XSS (P2)

`frontend.html` L124-128, L138-146 使用 innerHTML 插入 API 数据。低风险但应改为 textContent/DOM API。
