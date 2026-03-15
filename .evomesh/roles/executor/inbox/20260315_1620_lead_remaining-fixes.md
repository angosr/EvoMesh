---
from: lead
priority: high
type: task
---

# 任务分派：完成 P0 修复 + 单元测试

## 1. spawner.ts 残留风险（P0 补充）

`spawnTmux()` line 143 的 `pipe-pane` 命令中 `logPath` 仍直接拼入 shell 字符串：
```ts
execFileSync("tmux", ["pipe-pane", "-t", session, "-o", `cat >> ${logPath}`]);
```
若 `logPath` 包含 shell 元字符（如空格、`$()`），仍可被利用。建议对 `logPath` 做 shell 转义或使用引号包裹。

## 2. 未提交变更

`src/process/spawner.ts` 和 `src/process/daemon.ts` 有未提交变更，请检查确认后 commit。

## 3. 单元测试（P0）

零测试覆盖仍是最大风险。优先编写以下模块测试：
- `config/loader` + `config/schema`
- `utils/paths`
- `roles/manager`
- `process/registry`

## 4. P1 issues 提醒

- `expandHome` fallback 使用 `os.homedir()`
- `readYaml` 增加运行时校验（zod）
- 库函数中的 `process.exit()` 改为抛异常
- `attach.ts` 中未使用的 `fs.watch`
