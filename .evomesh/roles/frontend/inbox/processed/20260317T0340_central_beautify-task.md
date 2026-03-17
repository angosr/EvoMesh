---
from: central
priority: P1
type: task
---

## 任务：基于 frontend-design skill 美化前端 + 提高代码质量

**来源**: 用户直接指令

### 美化目标

参考 `.claude/skills/frontend-design/SKILL.md` 的设计理念，对 EvoMesh Web UI 进行视觉升级：

1. **字体**: 替换通用字体，选择有辨识度的 display + body 字体组合
2. **配色**: 设计一套 EvoMesh 品牌色系（CSS 变量），暗/亮主题都要有质感
3. **动效**: 关键交互加入微动画（页面加载、面板切换、按钮反馈）
4. **布局**: 审查现有布局，改善视觉层次和空间节奏
5. **细节**: 阴影、圆角、边框、hover 状态等统一打磨

### 代码质量目标

1. CSS 变量统一管理颜色/间距/字体
2. JS 函数拆分，消除重复逻辑
3. 事件绑定规范化
4. 注释补齐关键逻辑
5. 确保移动端适配不退化

### 文件范围

- `src/server/frontend.html`
- `src/server/frontend.js`
- `src/server/frontend-panels.js`
- `src/server/frontend-settings.js`
- `src/server/frontend.css`

### 约束

- 保持原生 HTML/CSS/JS，不引入框架
- 渐进式改进，每次 loop 做一个模块，避免一次性大改
- 每轮改完要在浏览器验证
