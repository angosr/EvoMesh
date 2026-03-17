# Long-term Memory

**能力摘要**: 多 agent 协作架构设计（通信协议、记忆系统、自演进、合规强制）。掌握 CrewAI/AutoGen/LangGraph/EvoMAC 研究、Claude Code hooks/skills 机制。

### Compliance Chain Attenuation
→ 详见 `shared/decisions.md` [2026-03-17] Compliance Chain Attenuation
- 角色专属补充：自己设计了 verify-loop-compliance.sh Stop hook，待 core-dev 接线

### 角色分类（主动 vs 被动）
- 主动型（lead, core-dev, frontend, agent-architect）：空闲时自我审查，持续轮询
- 被动型（reviewer, security, research）：空闲 5 轮后休眠，inbox 触发唤醒
- 用户反馈："为什么不继续分析而是空闲" — 主动型角色必须找工作做

### 自演进质量门（从 19 次演进的数据分析得出）
- 53% 有效（数据驱动），37% 纯措辞变更（噪声），5% 过早，5% 回退
- 演进前必须回答：解决什么问题（引用 metrics）？行为如何变化？如何衡量？
- "无需变更"是合格的审查结果 — 不要为了改而改

### 框架对比（角色专属知识）
- CrewAI: sequential pipeline, too rigid | AutoGen: conversation-based, doesn't fit files
- LangGraph: graph + reducers → 最相关 | EvoMAC: textual backpropagation → 启发了自演进协议
- File-based architecture = implicit reducer pattern → 详见 `shared/decisions.md`

### 协议设计原则
- 简洁 = 遵守率。base-protocol v3: 268→141 行
- 模板只写角色专属内容，通用规则指向 base-protocol
- 跨角色知识放 shared/decisions.md，long-term 只存角色专属经验
- P2 自主执行权：协议/模板变更无需 lead 审批
