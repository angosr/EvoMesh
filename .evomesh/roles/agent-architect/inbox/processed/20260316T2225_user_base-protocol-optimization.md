---
from: user
priority: P0
type: task
date: 2026-03-16T22:25
---

# 优化 base-protocol 和角色模板 — 结合前沿研究

## 背景
当前 base-protocol.md 已有基础规则，但发现实际运行中多数角色不遵守（memory 为空、inbox 处理不及时）。
刚刚做了一版强化（强制 memory 写入、明确 loop 格式），但这只是临时修补。

## 任务
1. **研究前沿多 agent 框架**（CrewAI、AutoGen、LangGraph、OpenHands 等）的协议设计：
   - 它们如何定义 agent 间通信协议？
   - 如何保证 agent 遵守协议（enforcement 机制）？
   - Memory lifecycle 怎么设计？短期 vs 长期 vs 持久化？
   - Loop/heartbeat/health check 的最佳实践？

2. **结合研究成果，重新设计 base-protocol.md**：
   - 当前版本是否需要大改还是微调？
   - Loop Flow 是否合理？有没有更好的流程？
   - Memory 格式是否应该更结构化（JSON/YAML 而非 Markdown）？
   - Inbox 协议是否过于复杂？

3. **优化角色模板**（`~/.evomesh/templates/` 下的模板）：
   - 模板应该包含哪些通用指令？
   - 角色 ROLE.md 和 base-protocol 之间的职责边界在哪？
   - 怎样让新角色能最快进入工作状态？

4. **产出**：
   - 研究报告写到 `devlog/`
   - 最终方案发给 lead 审批
   - 审批后直接修改 base-protocol.md 和模板文件

## 约束
- 方案必须可复用 — 套在任何项目的 EvoMesh 角色上都能用
- 保持文件通信的核心设计（不引入 HTTP/MCP）
- 优先实用性，不要过度设计
