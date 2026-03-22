import fs from "node:fs";
import path from "node:path";
import { ensureDir, writeFile, writeYaml, exists } from "../utils/fs.js";
import { defaultConfig } from "../config/defaults.js";
import { detectExistingRoles, generateBootstrapContext } from "./detect.js";
import type { DetectedRole } from "./detect.js";

export interface ScaffoldResult {
  /** Whether existing role designs were detected */
  hasExistingRoles: boolean;
  /** Detected role files (empty if none) */
  detected: DetectedRole[];
}

export function scaffoldProject(root: string, name: string): ScaffoldResult {
  const evomesh = path.join(root, ".evomesh");

  if (exists(evomesh)) {
    throw new Error(".evomesh/ already exists. Use `evomesh role create` to add roles.");
  }

  // Detect existing role designs BEFORE creating .evomesh/
  const detected = detectExistingRoles(root);

  // Create directory structure
  ensureDir(evomesh);
  ensureDir(path.join(evomesh, "roles"));
  ensureDir(path.join(evomesh, "shared"));
  ensureDir(path.join(evomesh, "runtime"));
  ensureDir(path.join(root, "devlog"));

  // project.yaml
  const config = defaultConfig(name);
  writeYaml(path.join(evomesh, "project.yaml"), config);

  // Blueprint and status (lead-only docs)
  writeFile(
    path.join(evomesh, "blueprint.md"),
    `# ${name} — 战略蓝图

> 本文件仅由 Lead 角色维护，其他角色只读。

## 项目愿景

（待填写）

## 技术路线

（待填写）

## 里程碑

（待填写）

## 架构决策

（待填写）
`
  );

  writeFile(
    path.join(evomesh, "status.md"),
    `# ${name} — 项目现况

> 本文件仅由 Lead 角色维护，其他角色只读。

## 当前进度

（项目刚初始化）

## 角色状态

（暂无角色）

## 风险项

（暂无）
`
  );

  // Shared docs
  writeFile(
    path.join(evomesh, "shared", "decisions.md"),
    "# 技术决策记录\n\n（暂无）\n"
  );
  writeFile(
    path.join(evomesh, "shared", "blockers.md"),
    "# 阻塞问题\n\n（暂无）\n"
  );
  writeFile(
    path.join(evomesh, "shared", "claims.json"),
    '{"claims": []}\n'
  );

  // If existing roles detected, write bootstrap context
  if (detected.length > 0) {
    writeFile(
      path.join(evomesh, "bootstrap-context.md"),
      generateBootstrapContext(name, detected),
    );
  }

  // Gitignore — exclude runtime files that are regenerated each loop
  const RUNTIME_GITIGNORE = `
# EvoMesh runtime (regenerated each loop, not source code)
.evomesh/runtime/
.evomesh/project.yaml
.evomesh/project.yaml.bak
.evomesh/templates/
.evomesh/roles/*/.session-id
.evomesh/roles/*/memory/short-term.md
.evomesh/roles/*/heartbeat.json
.evomesh/roles/*/role-card.json
.evomesh/roles/*/inbox/processed/
`;
  const gitignorePath = path.join(root, ".gitignore");
  if (exists(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (!content.includes(".evomesh/roles/*/heartbeat.json")) {
      fs.appendFileSync(gitignorePath, RUNTIME_GITIGNORE);
    }
  } else {
    writeFile(gitignorePath, RUNTIME_GITIGNORE.trim() + "\n");
  }

  return { hasExistingRoles: detected.length > 0, detected };
}
