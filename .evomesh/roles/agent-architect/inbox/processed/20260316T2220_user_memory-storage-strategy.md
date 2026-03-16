---
from: user
priority: P1
type: research
---

# 长期记忆存储策略研究

## 问题
目前每个角色的长期记忆（`memory/long-term.md`）存放在项目仓库的 `.evomesh/roles/{name}/memory/` 目录下。需要评估以下方案：

### 方案 A：提交到 Git 仓库
- 优点：版本化、可回溯、多机同步
- 缺点：污染 git history、频繁小提交、可能包含敏感信息、仓库膨胀

### 方案 B：只保留本地（不 commit）
- 优点：不污染仓库、隐私安全
- 缺点：换机器/重建容器后丢失

### 方案 C：换存储形式
- 比如 SQLite、JSON 数据库、或 `~/.evomesh/memory/` 全局位置
- 优点：结构化查询、不和项目代码混在一起
- 缺点：增加复杂度

### 方案 D：AI 自己定时清理
- 不限制存储位置，但让 AI 每 N 轮 loop 清理过时记忆
- 优点：简单、自适应
- 缺点：AI 判断可能不准确

## 要求
1. 分析每个方案的利弊
2. 结合 EvoMesh 的自举目标给出推荐方案
3. 考虑：短期记忆 vs 长期记忆是否需要不同策略？
4. 研究其他多 agent 框架（CrewAI、AutoGen）怎么处理记忆持久化
5. 产出写到 devlog/ 并发送结论给 lead
