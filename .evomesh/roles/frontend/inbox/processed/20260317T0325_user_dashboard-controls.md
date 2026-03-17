---
from: user
priority: P0
type: task
date: 2026-03-17T03:25
---

# Dashboard 缺少 Stop 按钮和 Launch Mode 选择

## 当前
每个角色只有一个按钮：运行中 → "↻ Restart"，停止 → "▶ Start"。

## 需要增加

### 1. Stop 按钮
运行中的角色显示两个按钮：`↻ Restart` + `■ Stop`
Stop 调用 `POST /api/projects/:slug/roles/:name/stop`（已有 API）。

### 2. Launch Mode 选择
每个角色增加一个下拉框：`docker` | `host`
- 默认 `docker`（当前所有角色）
- 选择后保存到 project.yaml 的 `launch_mode` 字段
- 需要重启角色才生效（选择后提示）
- 调用 `POST /api/projects/:slug/roles/:name/config` 保存（复用已有的 config API，增加 launch_mode 字段）

### 3. Actions 列布局
```
[▶ Start / ↻ Restart]  [■ Stop]  [docker ▼]
```
Stop 用红色样式（dash-action danger）。Launch mode 下拉和 account 下拉样式一致。

## API 改动（core-dev）
`POST /api/projects/:slug/roles/:name/config` 需要支持 `launch_mode` 字段的保存。
