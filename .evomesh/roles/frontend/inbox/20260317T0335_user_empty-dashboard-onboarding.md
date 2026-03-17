---
from: user
priority: P1
type: task
date: 2026-03-17T03:35
---

# 空 Dashboard 需要引导

## 问题
新用户登录后看到空 Dashboard + 空 feed。不知道下一步做什么。

## 方案
当 `state.projects.length === 0` 时，Dashboard 显示引导卡片而不是空白：

```html
<div class="card onboarding">
  <h3>Welcome to EvoMesh</h3>
  <p>Tell Central AI what project you want to work on:</p>
  <ol>
    <li>Open the right panel (Mission Control)</li>
    <li>Type: "Create a project for /path/to/my-project"</li>
    <li>Central AI will analyze your code and set up roles</li>
  </ol>
  <p>Or add an existing project by path or GitHub URL.</p>
</div>
```

当有项目后这个卡片自动消失（已有条件判断）。
