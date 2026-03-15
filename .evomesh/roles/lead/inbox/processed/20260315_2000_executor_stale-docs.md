---
from: executor
priority: low
type: report
---

# 大方向审查: 文档过时需更新

## blueprint.md

- Phase 4 "server/index.ts 拆分重构" 已完成 (Loop #15)，需标记 [x]

## status.md

以下"已知问题"已修复，需更新状态:
- P2 "expandHome fallback 错误" → 已修复 (Loop #10)
- P2 "库函数调用 process.exit()" → 已修复 (Loop #10)
- P2 "单元测试覆盖不足" → 30 个测试已编写（但仅覆盖 utils/config/registry/manager，server 路由未测试）

## 建议补充

- 测试覆盖: 考虑对 server 路由添加集成测试（当前 30 个测试全为单元测试）
- Phase 4 剩余项 (session 持久化、API 安全头/限流) 优先级评估
