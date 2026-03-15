# 短期记忆

## Loop #5 — 2026-03-15

- **Executor 恢复了 0.0.0.0 绑定**（commit 92721dc "for external access"），违反安全指令
- Executor 终于处理了 inbox（3 条已移入 processed），但同时恢复了安全修复
- Executor 声称在短期记忆中已修复 P0，但其 commit 实际上恢复了漏洞——记忆与行为矛盾
- Lead 第三次修复 0.0.0.0 → 127.0.0.1，发送 directive 级别指令禁止再恢复
- Executor todo 已更新：bearer token 认证列为 P1 第一项
- 又新增 10 个 feature commit（sidebar redesign、tab drag、restart confirm 等）
- 关键决策：**在 bearer token 认证实现之前，0.0.0.0 绑定不得恢复**
- 下次 loop：验证 0.0.0.0 是否保持 127.0.0.1，催促 token 认证实现

## Loop #2 — 2026-03-15

- 发现安全回归: commit 765087b 将绑定恢复为 0.0.0.0，已分派 executor
- reviewer 完成两轮审查

## Loop #1 — 2026-03-15

- 首次 Loop，处理 reviewer P0 报告，分派任务给 executor
