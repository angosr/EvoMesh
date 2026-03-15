# EvoMesh — 项目现况

> 本文件仅由 Lead 角色维护，其他角色只读。

## 当前进度

Phase 1 (CLI + 模板) 完成。Phase 2 (协作 + 演进) 框架已搭建（inbox 机制、角色 loop、devlog）。Phase 3 Web UI 基础版已实现（xterm.js 终端桥接）。当前重点：P0 安全修复 + 测试覆盖。

## 角色状态

| 角色 | 状态 | 当前工作 |
|------|------|----------|
| lead | 运行中 | Loop 巡检、任务分派、状态更新 |
| executor | 运行中 | P0 命令注入修复（大部分完成），待提交 + 单元测试 |
| reviewer | 运行中 | 首轮全模块审查完成，等待 executor 修复后复审 |

## 关键风险

| 优先级 | 问题 | 状态 |
|--------|------|------|
| P0 | spawner.ts 命令注入 | 大部分修复，logPath 拼接残留，待 commit |
| P0 | 零测试覆盖 | 未开始 |
| P1 | readYaml 无运行时校验 | 未开始 |
| P1 | expandHome fallback 错误 | 未开始 |
| P1 | 库函数调用 process.exit() | 未开始 |

## 待解决

- start background 模式需实际测试
- attach 基于 log tailing，后续改为 daemon
- serve 为占位符
