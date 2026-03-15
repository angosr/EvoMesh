# executor — 待办任务

## 当前优先

1. **拆分 frontend.html (1167行，超过1000行上限)**: 将 CSS 和 JS 提取为独立文件：
   - `server/frontend.css` — 所有样式
   - `server/frontend.js` — 所有脚本逻辑
   - `server/frontend.html` — 仅 HTML 结构，引用 CSS/JS
   - 注意：由于是单文件 SPA，CSS/JS 需要内联 serve（不依赖外部文件系统路径），可在 index.ts 中注册 `/app.css` 和 `/app.js` 路由来 serve 这些文件
   - 确保拆分后功能完全不变，所有测试通过

## 待排期

- `readYaml` 运行时校验（zod）— 当前风险低，配置由 scaffold 生成
- Server 路由集成测试
