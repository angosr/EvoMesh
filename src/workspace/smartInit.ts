import fs from "node:fs";
import path from "node:path";
import { exists, ensureDir, writeFile, writeYaml } from "../utils/fs.js";
import { defaultConfig } from "../config/defaults.js";
import { createRole } from "../roles/manager.js";
import { loadConfig } from "../config/loader.js";
import type { ProjectConfig, Lang } from "../config/schema.js";

/**
 * Initialize a project for EvoMesh, preserving existing custom content.
 * - If .evomesh/ already exists and has roles, returns as-is
 * - If .evomesh/ exists but no roles, creates default lead + executor
 * - If no .evomesh/, scaffolds everything then creates default roles
 */
export function smartInit(root: string, name: string, lang: Lang = "zh"): ProjectConfig {
  const evomesh = path.join(root, ".evomesh");
  const projectYaml = path.join(evomesh, "project.yaml");

  if (exists(projectYaml)) {
    // Already initialized — check if roles exist
    const config = loadConfig(root);
    if (Object.keys(config.roles).length > 0) {
      return config; // fully set up
    }
    // Has config but no roles — create defaults
    createRole(root, "lead", "lead", config, "main");
    createRole(root, "executor", "executor", config, "main");
    return loadConfig(root);
  }

  // Fresh init — scaffold structure
  ensureDir(evomesh);
  ensureDir(path.join(evomesh, "roles"));
  ensureDir(path.join(evomesh, "shared"));
  ensureDir(path.join(evomesh, "runtime"));

  if (!exists(path.join(root, "devlog"))) {
    ensureDir(path.join(root, "devlog"));
  }

  const config = defaultConfig(name, lang);
  writeYaml(projectYaml, config);

  // Write shared docs only if missing
  const isEn = lang === "en";
  const sharedDir = path.join(evomesh, "shared");
  if (!exists(path.join(sharedDir, "decisions.md"))) {
    writeFile(path.join(sharedDir, "decisions.md"), isEn ? "# Technical Decisions\n\n(none yet)\n" : "# 技术决策记录\n\n（暂无）\n");
  }
  if (!exists(path.join(sharedDir, "blockers.md"))) {
    writeFile(path.join(sharedDir, "blockers.md"), isEn ? "# Blockers\n\n(none yet)\n" : "# 阻塞问题\n\n（暂无）\n");
  }

  // Blueprint and status
  if (!exists(path.join(evomesh, "blueprint.md"))) {
    writeFile(path.join(evomesh, "blueprint.md"), isEn ? `# ${name} — Strategic Blueprint\n\n(to be filled)\n` : `# ${name} — 战略蓝图\n\n（待填写）\n`);
  }
  if (!exists(path.join(evomesh, "status.md"))) {
    writeFile(path.join(evomesh, "status.md"), isEn ? `# ${name} — Project Status\n\n(just initialized)\n` : `# ${name} — 项目现况\n\n（项目刚初始化）\n`);
  }

  // Gitignore
  const gitignorePath = path.join(root, ".gitignore");
  if (exists(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (!content.includes(".evomesh/runtime/")) {
      fs.appendFileSync(gitignorePath, "\n.evomesh/runtime/\n");
    }
  } else {
    writeFile(gitignorePath, ".evomesh/runtime/\n");
  }

  // Create default roles
  createRole(root, "lead", "lead", config, "main");
  createRole(root, "executor", "executor", config, "main");

  return loadConfig(root);
}
