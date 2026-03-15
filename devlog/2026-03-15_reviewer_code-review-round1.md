# Code Review Round 1 — src/ 全模块审查

**Date**: 2026-03-15
**Reviewer**: reviewer
**Scope**: src/ 全部 22 个 TypeScript 文件

---

## 总体评价

项目处于早期阶段（2 commits），代码结构清晰、模块划分合理。主要问题集中在：**零测试覆盖**、**安全隐患**、**错误处理不足**。

---

## 严重问题（P0）

### 1. 命令注入漏洞 — `src/process/spawner.ts:129,153`

`spawnTmux()` 中通过字符串拼接构造 shell 命令，`accountPath`、`session`、`loopPrompt` 均未转义：

```ts
// L129: accountPath 直接拼入 shell 字符串
`"CLAUDE_CONFIG_DIR='${accountPath}' claude --dangerously-skip-permissions"`

// L153: loopPrompt 仅做了单引号转义，但 session 名未转义
`tmux send-keys -t ${session} '/loop ${interval} ${loopPrompt.replace(/'/g, "'\\''")}' Enter`
```

**风险**: 若 `accountPath` 或角色名包含 shell 元字符（`'; rm -rf /`），可执行任意命令。

**建议**: 使用 `execFileSync` 代替 `execSync`（避免 shell 解析），或对所有参数进行 `shellescape`。

### 2. 零测试覆盖

项目无任何测试文件（`tests/` 目录为空，无 `*.test.ts`）。所有模块均未测试。

**建议**: 优先为 `config/loader`、`utils/paths`、`roles/manager`、`process/registry` 编写单元测试。

---

## 重要问题（P1）

### 3. `readYaml<T>` 无运行时校验 — `src/utils/fs.ts:22`

```ts
export function readYaml<T>(filePath: string): T {
  return YAML.parse(fs.readFileSync(filePath, "utf-8")) as T;
}
```

`as T` 仅是编译时断言，若 YAML 文件内容格式不符合 `ProjectConfig`，运行时不会报错而是产生不可预测行为。

**建议**: 使用 zod 或类似库做运行时 schema 校验。

### 4. `expandHome` fallback 不安全 — `src/utils/paths.ts:49`

```ts
return path.join(process.env.HOME || "/home", p.slice(2));
```

当 `HOME` 未设置时，fallback 到 `/home` 而非 `/home/<user>`，导致路径错误。

**建议**: 使用 `os.homedir()` 代替手动读取 `HOME`。

### 5. `attach` 命令的 `fs.watch` 未使用 — `src/commands/attach.ts:39-41`

```ts
const watcher = fs.watch(logPath, () => {
  // Re-read on change (simple approach)
});
```

`watcher` 回调为空，仅靠 `setInterval` 轮询。`watcher` 浪费资源。

**建议**: 移除无用的 `fs.watch`，或改用 `fs.watch` 事件驱动代替轮询。

### 6. `resolveAccountPath` 用 `process.exit(1)` 处理错误 — `src/config/loader.ts:17`

库函数不应调用 `process.exit`，这让函数无法在测试中使用。`manager.ts`、`paths.ts` 也有同样问题。

**建议**: 抛出自定义错误，由 CLI 入口统一 catch 并 exit。

---

## 一般问题（P2）

### 7. `daemon.ts` 与 `spawner.ts` 中 `spawnForeground` 逻辑重复

两个文件都实现了 PTY spawn + "bypass permissions" 检测 + `/loop` 注入。建议提取为共享函数。

### 8. 角色模板硬编码中文字符串

`lead.ts`、`executor.ts`、`reviewer.ts` 模板中所有文本硬编码中文。若未来需要国际化，改动量很大。低优先级，记录在此。

### 9. `listRunning` 中 `.pid` 文件可能残留

进程崩溃后 PID 文件不会被清理，`isAlive` 可以检测到进程已死，但 PID 可能被系统回收分配给其他进程，导致误判。

**建议**: 在 PID 文件中同时写入启动时间戳，校验时对比 `/proc/<pid>/stat` 的启动时间。

---

## 审查统计

| 维度 | 评分 | 说明 |
|------|------|------|
| 正确性 | 7/10 | 核心逻辑正确，但 YAML 无校验、HOME fallback 有 bug |
| 可读性 | 8/10 | 模块划分清晰，命名规范 |
| 性能 | 9/10 | CLI 工具，无明显瓶颈 |
| 安全性 | 4/10 | 命令注入漏洞 |
| 测试覆盖 | 0/10 | 零测试 |
| **综合** | **5.6/10** | |

---

## 下一步

1. 通过 inbox 将 P0 问题（命令注入、零测试）报告给 lead
2. 通过 inbox 将代码问题 feedback 发给 executor
3. 第二轮审查：ROLE.md 模板内容（todo #2）
