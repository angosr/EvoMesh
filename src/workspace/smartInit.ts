import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exists, ensureDir, writeFile, writeYaml } from "../utils/fs.js";
import { defaultConfig } from "../config/defaults.js";
import { createRole } from "../roles/manager.js";
import { loadConfig } from "../config/loader.js";
import type { ProjectConfig, Lang } from "../config/schema.js";

/**
 * Resolve a template file: check global ~/.evomesh/templates/ first,
 * then project-local .evomesh/templates/, return content or null.
 */
function readTemplate(subpath: string): string | null {
  const global = path.join(os.homedir(), ".evomesh", "templates", subpath);
  if (fs.existsSync(global)) return fs.readFileSync(global, "utf-8");
  // Project-local fallback (for repos that ship templates)
  const local = path.join(".evomesh", "templates", subpath);
  if (fs.existsSync(local)) return fs.readFileSync(local, "utf-8");
  return null;
}

/**
 * Replace {placeholder} variables in template content.
 */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

/**
 * Scan ~/.claude* directories, return the least-loaded account path.
 * "Load" = number of roles currently assigned to that account across workspace.
 */
function pickAccount(usedAccounts: Record<string, number>): string {
  const homeDir = os.homedir();
  const candidates: string[] = [];
  try {
    for (const entry of fs.readdirSync(homeDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith(".claude")) {
        const fullPath = path.join(homeDir, entry.name);
        // Must have credentials to be usable
        if (fs.existsSync(path.join(fullPath, ".credentials.json"))) {
          candidates.push(`~/${entry.name}`);
        }
      }
    }
  } catch (err) {
    console.error("pickAccount: failed to scan home directory:", err);
  }
  if (candidates.length === 0) return "~/.claude";

  // Pick least-loaded
  candidates.sort((a, b) => (usedAccounts[a] || 0) - (usedAccounts[b] || 0));
  return candidates[0] ?? "~/.claude";
}

/**
 * Initialize a project for EvoMesh, preserving existing custom content.
 * Uses file-based templates when available, falls back to hardcoded defaults.
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

  // Template variables
  const today = new Date().toISOString().slice(0, 10);
  const leadAccount = pickAccount({});
  const executorAccount = pickAccount({ [leadAccount]: 1 });
  const defaultAccount = leadAccount;
  const vars: Record<string, string> = {
    project_name: name,
    created_date: today,
    repo_url: "",
    lang,
    default_account: defaultAccount,
  };

  // Try template-based project.yaml, fall back to code defaults
  const projectTmpl = readTemplate("project-scaffold/project.yaml.tmpl");
  let config: ProjectConfig;
  if (projectTmpl) {
    const rendered = renderTemplate(projectTmpl, vars);
    fs.writeFileSync(projectYaml, rendered, "utf-8");
    config = loadConfig(root);
    // Assign different accounts to lead vs executor if available
    if (config.roles.lead) config.roles.lead.account = "default";
    if (config.roles.executor) config.roles.executor.account = "default";
    if (leadAccount !== executorAccount && Object.keys(config.accounts).length <= 1) {
      config.accounts["alt"] = executorAccount;
      if (config.roles.executor) config.roles.executor.account = "alt";
    }
    writeYaml(projectYaml, config);
  } else {
    config = defaultConfig(name, lang);
    writeYaml(projectYaml, config);
  }

  // Shared docs
  const sharedDir = path.join(evomesh, "shared");
  if (!exists(path.join(sharedDir, "decisions.md"))) {
    writeFile(path.join(sharedDir, "decisions.md"), lang === "en" ? "# Technical Decisions\n\n(none yet)\n" : "# 技术决策记录\n\n（暂无）\n");
  }
  if (!exists(path.join(sharedDir, "blockers.md"))) {
    writeFile(path.join(sharedDir, "blockers.md"), lang === "en" ? "# Blockers\n\n(none yet)\n" : "# 阻塞问题\n\n（暂无）\n");
  }
  if (!exists(path.join(sharedDir, "claims.json"))) {
    writeFile(path.join(sharedDir, "claims.json"), '{"claims": []}\n');
  }

  // Blueprint — template or fallback
  if (!exists(path.join(evomesh, "blueprint.md"))) {
    const tmpl = readTemplate("project-scaffold/blueprint.md.tmpl");
    writeFile(path.join(evomesh, "blueprint.md"),
      tmpl ? renderTemplate(tmpl, vars) : (lang === "en" ? `# ${name} — Strategic Blueprint\n\n(to be filled)\n` : `# ${name} — 战略蓝图\n\n（待填写）\n`));
  }
  if (!exists(path.join(evomesh, "status.md"))) {
    const tmpl = readTemplate("project-scaffold/status.md.tmpl");
    writeFile(path.join(evomesh, "status.md"),
      tmpl ? renderTemplate(tmpl, vars) : (lang === "en" ? `# ${name} — Project Status\n\n(just initialized)\n` : `# ${name} — 项目现况\n\n（项目刚初始化）\n`));
  }

  // CLAUDE.md — EvoMesh universal rules (auto-loaded by Claude Code)
  const claudeMdPath = path.join(root, "CLAUDE.md");
  if (!exists(claudeMdPath)) {
    const tmpl = readTemplate("project-scaffold/CLAUDE.md.tmpl");
    if (tmpl) {
      writeFile(claudeMdPath, renderTemplate(tmpl, vars));
    }
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

  // Create default roles — template-based ROLE.md if available
  createRole(root, "lead", "lead", config, config.roles.lead?.account || "default");
  createRole(root, "executor", "executor", config, config.roles.executor?.account || "default");

  return loadConfig(root);
}
