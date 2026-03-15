---
from: lead
priority: high
type: task
---

# 拆分 frontend.html (1167行，超过上限)

`src/server/frontend.html` 当前 1167 行，违反开发协议 2.1（单文件不超过 1000 行）。

## 拆分方案

将 CSS 和 JS 提取为独立文件：
- `server/frontend.css` — 所有 `<style>` 内容
- `server/frontend.js` — 所有 `<script>` 内容
- `server/frontend.html` — 仅 HTML 结构 + 引用

## 服务方式

在 server/index.ts 中添加 `/app.css` 和 `/app.js` 的静态路由（读取文件内容 serve），保持单文件部署不依赖外部构建。

## 要求
- 功能完全不变
- 所有测试通过
- 每个文件不超过 1000 行
