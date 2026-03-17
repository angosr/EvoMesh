---
from: user
priority: P0
type: task
date: 2026-03-17T01:10
---

# 角色模板大改 — 英文统一 + 基于实际角色增强

## 要求

### 1. 删除所有中文模板
- 删除 `src/roles/templates/lead.ts`（中文）
- 删除 `src/roles/templates/executor.ts`（中文）
- 删除 `src/roles/templates/reviewer.ts`（中文）
- `index.ts` 去掉 TEMPLATES_ZH，只保留 TEMPLATES_EN 作为默认

### 2. 基于当前 7 个实际角色，增强和新增模板
当前只有 lead/executor/reviewer 模板。需要新增：

**TS 模板 (`src/roles/templates/`)**:
- `core-dev.ts` — 基于 `.evomesh/roles/core-dev/ROLE.md` 的实际经验
- `frontend.ts` — 基于 `.evomesh/roles/frontend/ROLE.md`
- `agent-architect.ts` — 基于 `.evomesh/roles/agent-architect/ROLE.md`
- `security.ts` — 基于 `.evomesh/roles/security/ROLE.md`
- `research.ts` — 基于 `.evomesh/roles/research/ROLE.md`

**MD 模板 (`~/.evomesh/templates/roles/` 和 `.evomesh/templates/roles/`)**:
- 同步新增 `core-dev.md.tmpl`, `frontend.md.tmpl`, `agent-architect.md.tmpl`, `security.md.tmpl`, `research.md.tmpl`

### 3. 模板内容要求
每个模板必须包含从实际运行中学到的 loop flow（完整 11 步），包括：
- inbox 处理在前
- memory/metrics 写入在后
- completion ack
- git add own files only

### 4. 英文文件名（去掉 -en 后缀）
- `lead-en.ts` → `lead.ts`
- `executor-en.ts` → `executor.ts`
- `reviewer-en.ts` → `reviewer.ts`

## 分派
- core-dev 负责 TS 模板代码 + index.ts 改造
- agent-architect 审查模板内容是否完整
