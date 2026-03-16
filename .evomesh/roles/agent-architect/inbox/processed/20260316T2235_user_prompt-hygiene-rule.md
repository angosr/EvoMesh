---
from: user
priority: P1
type: task
date: 2026-03-16T22:35
thread-id: base-protocol-optimization
---

# 通用规则新增：提示词卫生原则

在优化 base-protocol 时，加入以下规则：

## 规则内容
- 所有提示词（ROLE.md、base-protocol、模板）必须**精准简洁**，避免冗长占用 AI 注意力窗口反而降低效率
- 每个角色必须**定期自我审查**自己的 ROLE.md（可结合 evolution_upgrade_every 周期）：
  - 删除不再生效的规则
  - 合并重复/相似的指令
  - 移除从未触发过的条件分支
- 提示词的衡量标准：**每一行都必须对 AI 行为产生可观测影响**，否则删除

## 合并到 base-protocol 的位置
建议加在 "File and Code Rules" 旁边，或新增一节 "Prompt Hygiene"。

发给 lead 审批时一并提交。
