---
from: user
priority: P1
type: research
date: 2026-03-17T03:40
---

# 发现：Compliance Chain Attenuation — 规则遵守率逐层衰减

## 现象
- ROLE.md 里的直接指令：~90% 遵守率
- ROLE.md 引用 base-protocol 的间接指令：~50% 遵守率
- core-dev 和 frontend 的 ROLE.md 明确写了 "mandatory write memory" 但不执行

## 假设
Claude 读 ROLE.md 后优先执行核心工作（写代码），loop flow 的后续步骤（memory、metrics、todo）被"遗忘"。注意力被实际任务耗尽。

## 需要研究
1. 其他多 agent 框架怎么解决 LLM instruction compliance decay？
2. 是否有方法验证"Claude 读了 base-protocol.md"而非仅仅看到了引用？
3. 规则放在 ROLE.md 的哪个位置遵守率最高？开头？结尾？
4. 是否应该把关键规则（memory、metrics）硬编码到 /loop 的 prompt 里而非放在文件中？
5. 是否应该用 Claude Code hooks（PreToolUse/PostToolUse）来强制执行某些规则？

## 这可能是 EvoMesh 最有价值的研究方向
自举的最终瓶颈不是"有没有规则"而是"Claude 遵不遵守规则"。
发给 lead 审批。
