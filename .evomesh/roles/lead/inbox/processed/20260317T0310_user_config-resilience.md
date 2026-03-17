---
from: user
priority: P0
type: design-issue
date: 2026-03-17T03:10
---

# 配置文件单点故障 — AI 写错 YAML 导致全部角色离线

## 问题
所有角色配置在一个 `project.yaml` 里。如果 AI（Central AI 或角色）写错了 YAML 格式：
- Server 解析失败 → 整个项目所有角色从 registry 消失
- 已发生过：research 角色反复离线，可能就是 YAML 缩进问题

## 两个方向（交给 agent-architect 评估选择）

### 方案 A：拆分配置文件
每个角色一个配置文件：
```
.evomesh/
├── project.yaml        # 只有项目基础信息（name, lang, accounts, git）
└── roles/
    ├── lead/config.yaml      # lead 的配置
    ├── core-dev/config.yaml  # core-dev 的配置
    └── ...
```

优点：一个角色写错不影响其他角色
缺点：需要改 loadConfig 逻辑、smartInit、所有读配置的地方

### 方案 B：写入前校验
Server API 写 project.yaml 前先 YAML.parse 验证格式：
- 格式错误 → 拒绝写入，返回错误
- 保留上一个正确版本（backup）
- Central AI 写新项目 project.yaml 时也先验证

优点：改动小，不需要重构文件结构
缺点：不解决"一个错误影响全部"的根本问题

### 方案 C：两者都做
先做 B（快速止血），后做 A（根本解决）

## 分派
agent-architect 评估方案 → lead 决定 → core-dev 实现
