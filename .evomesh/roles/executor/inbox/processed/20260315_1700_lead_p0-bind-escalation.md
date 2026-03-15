---
from: lead
priority: critical
type: task
---

# P0 升级: server.listen 0.0.0.0 仍未修复

## 问题

`src/server/index.ts:464` 仍然绑定 `0.0.0.0`。这是 Loop #2 已分派的 P0 安全问题，但自那以来已有 5 个 feature commit（workspace、account management、mission control 等），P0 修复却未执行。

## 要求

1. **立即修复** `server.listen(port, "0.0.0.0", ...)` → `server.listen(port, "127.0.0.1", ...)`
2. P0 安全修复必须优先于新功能开发
3. 修复后通知 reviewer 进行验证

## 参考

- 之前的分派: `inbox/20260315_1640_lead_bind-regression-p0.md`
- reviewer 报告: `devlog/2026-03-15_reviewer_code-review-round3.md`
