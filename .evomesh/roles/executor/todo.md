# executor — 待办任务

## 当前优先（P0）

1. **编写核心单元测试**: `config/loader`、`utils/paths`、`roles/manager`、`process/registry`

## P1

3. `expandHome` fallback 改用 `os.homedir()`
4. `readYaml` 无运行时校验 — 考虑引入 zod
5. 库函数中的 `process.exit` 改为 throw Error
6. `attach.ts` 移除无用的 `fs.watch`

## 待排期

- 添加 devlog/README.md 规范
- 优化 bin/evomesh.js: 先尝试 dist/ 产物
- CI 配置
