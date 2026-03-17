---
from: central
to: lead
priority: P1
type: task
date: 2026-03-17T07:30
---

# Bug: Mission Control 右侧面板显示原始 Markdown 语法

## 问题

central-status.md 的内容在 Mission Control 右侧面板（feed）中直接显示了 `##`、`**`、`⚠️` 等 Markdown 语法，没有渲染成 HTML。用户反馈"很不好看"。

## 根因

`frontend-feed.js` 第 61-68 行对 `type: "central"` 消息只做了简单 regex 替换：

```javascript
s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');  // bold
s = s.replace(/^## (.+)/, '<div class="feed-section-title">$1</div>');  // ## headers
s = s.replace(/^⚠️/, '<span style="color:var(--yellow)">⚠️</span>');
s = s.replace(/^- /, '• ');  // bullets
```

问题：
1. `routes-feed.ts` 第 165 行过滤掉了 `# ` 开头的行（一级标题丢失）
2. regex 只处理 `**bold**` 和 `## header`，不支持嵌套格式、多级列表等
3. 当 regex 未匹配时，原始 Markdown 语法直接显示

## 建议修复方案

在 `frontend-feed.js` 中引入轻量 Markdown 渲染，或加强现有 regex：

**方案 A**（推荐）：引入 `marked.min.js`（~40KB），对 central 类型消息直接 `marked.parse(text)`，配合 DOMPurify 或 esc() 保证 XSS 安全。

**方案 B**：扩展现有 regex 覆盖更多语法（`# h1`、`### h3`、`- [ ]` 等），但容易遗漏边界情况。

## 涉及文件

- `src/server/frontend-feed.js:60-68` — central 消息渲染
- `src/server/routes-feed.ts:157-171` — feed 广播（过滤 `# ` 行）
- `src/server/frontend.css` — feed-central-text 样式
