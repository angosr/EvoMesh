---
from: user
priority: P0
type: directive
date: 2026-03-17T00:50
---

# Central AI 必须成为超级秘书 — 当前完全不合格

## 现状
Central AI 的 central-status.md 只列角色 online/offline。这些信息 Mission Control 已经有了。
用户希望 Central AI 像一个超级秘书一样汇报：
- 各项目的实际开发进展和细节
- 遇到的问题和阻塞
- 决策历史和背景
- 角色之间的协作状态
- 主动发现的风险和建议

目前用户仍然需要和外部 session 沟通才能了解系统状态。Central AI 应该能完全替代这个需求。

## Central AI ROLE.md 需要重写的部分

### Status Reporting（Section VI）
当前：列 online/offline 表格
应该：

```markdown
# Central Status — {timestamp}

## 项目进展
### EvoMesh
- **本周完成**: brain-dead recovery、smartInit 模板迁移、base-protocol v2 共 11 个 section
- **正在进行**: dual launch mode 设计（P0）、compliance hooks（agent-architect）
- **阻塞**: core-dev memory 合规问题导致死锁（已解决）
- **风险**: 5/7 角色共用 account "2"，配额耗尽会导致 71% 瘫痪

### memorybench-arena
- **状态**: 0/2 角色运行，项目暂停
- **待用户决定**: 是否启动

## 角色健康
- lead: Loop 57, 活跃，inbox 0 ✅
- core-dev: 刚从 brain-dead 恢复，处理了 4 条积压 inbox
- frontend: 被 brain-dead 误杀重启了 3 次（已修复）
- agent-architect: 所有设计任务完成，idle
- 建议: research 和 reviewer 可考虑合并（稳定期冗余）

## 需要用户关注
1. dual launch mode 需要审批（改变 Central AI 运行方式）
2. memorybench-arena 是否继续运行？
3. 账号重新分配需要重启容器
```

这才是超级秘书级别的汇报。

## 行动
1. 重写 Central AI ROLE.md 的 Status Reporting section
2. 明确要求：每次 loop 必须扫描所有角色的 memory、todo、evolution.log
3. 输出必须包含：进展、阻塞、风险、建议、需要用户决定的事项
4. 不要列 online/offline — Mission Control 已经有了

## 前提
Central AI 需要 host 模式才能真正发挥作用（dual launch mode P0 已提交）。
但即使在当前 Docker 模式下，也应该先优化 ROLE.md 提高汇报质量。
