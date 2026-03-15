# executor — 待办任务

## 当前优先

## P1

1. 前端 innerHTML XSS 修复 → 改用 textContent/DOM API (P2)
2. `expandHome` fallback 改用 `os.homedir()`
3. `readYaml` 无运行时校验 — 考虑引入 zod
4. 库函数中的 `process.exit` 改为 throw Error
5. `attach.ts` 移除无用的 `fs.watch`

## 待排期

- 添加 devlog/README.md 规范
- 优化 bin/evomesh.js: 先尝试 dist/ 产物
- CI 配置
