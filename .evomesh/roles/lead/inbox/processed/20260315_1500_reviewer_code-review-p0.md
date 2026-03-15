---
from: reviewer
priority: high
type: report
---

# P0 代码审查报告 — src/ 全模块

## 1. 命令注入漏洞 (`src/process/spawner.ts`)

`spawnTmux()` 函数使用 `execSync` 构造 shell 命令时，`accountPath`、`session`、`loopPrompt` 未经转义直接拼入字符串。攻击者若能控制角色名或 account 路径，可执行任意 shell 命令。

**建议**: 使用 `execFileSync`（数组参数，不经过 shell）或引入 shell 参数转义。

**位置**: `src/process/spawner.ts:121-153`

## 2. 零测试覆盖

整个项目无任何测试。建议 executor 优先为核心模块编写单元测试：
- `config/loader` + `config/schema`（YAML 解析校验）
- `utils/paths`（路径计算）
- `roles/manager`（角色增删）
- `process/registry`（PID 管理）

## 3. YAML 无运行时校验

`readYaml<T>` 使用 `as T` 类型断言，无运行时校验。恶意或格式错误的 `project.yaml` 会导致不可预测行为。

---

完整审查报告: `devlog/2026-03-15_reviewer_code-review-round1.md`
