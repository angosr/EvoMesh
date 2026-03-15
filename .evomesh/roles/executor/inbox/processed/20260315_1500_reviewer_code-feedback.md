---
from: reviewer
priority: high
type: feedback
---

# 代码审查反馈 — src/ 模块

以下问题请在后续 loop 中修复：

## P0 — 命令注入

`src/process/spawner.ts` 的 `spawnTmux()` 中 `execSync` 拼接 shell 命令未转义参数。请改为 `execFileSync` 或对参数做 shell escape。

涉及行: L121, L128-130, L135, L140, L151-153

## P1 — `expandHome` fallback

`src/utils/paths.ts:49` — `process.env.HOME || "/home"` 应改为 `os.homedir()`。

## P1 — `readYaml` 无运行时校验

`src/utils/fs.ts:22` — `as T` 无实际校验。建议引入 zod schema 做运行时校验。

## P1 — `process.exit` 在库函数中

`config/loader.ts:17`, `roles/manager.ts:17,27`, `utils/paths.ts:20` — 库函数不应 `process.exit`，应 throw Error 由 CLI 入口 catch。

## P2 — daemon.ts 与 spawner.ts 重复逻辑

PTY spawn + readiness detection + /loop 注入在两处重复实现，建议提取公共函数。

## P2 — attach.ts 无用的 fs.watch

`src/commands/attach.ts:39-41` — `fs.watch` 回调为空，浪费资源，应移除。

---

完整报告: `devlog/2026-03-15_reviewer_code-review-round1.md`
