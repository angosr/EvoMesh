---
from: user
priority: P1
type: task
date: 2026-03-16T23:30
---

# 右侧 Mission Control 面板移动端适配

## 问题
右侧 Mission Control 面板在移动端体验差，需要优化。

## 要求
1. 移动端点击右上角按钮展开时，面板应全屏覆盖（不是半屏）
2. Tab 切换区域触控友好，间距足够
3. Activity/Issues/Tasks 列表项在小屏幕上不溢出、不截断
4. Central AI tab 的输入框在移动端键盘弹出时不被遮挡
5. 底部 quick command 输入框在移动端合理显示
6. 关闭/收起面板的操作要明显且容易点击

## 参考
当前移动端适配逻辑在 `frontend.css` 的 `@media (max-width: 768px)` 里，在此基础上优化。
