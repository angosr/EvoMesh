import fs from "node:fs";
import path from "node:path";
import { exists } from "../utils/fs.js";

/** A detected role-like file with its content */
export interface DetectedRole {
  /** Original file path relative to project root */
  path: string;
  /** File content */
  content: string;
  /** How we identified this as a role file */
  source: "role-dir" | "claude-md" | "prompt-file" | "agent-config";
}

/**
 * Scan the project directory for existing role designs, prompt files,
 * or agent configurations that indicate pre-existing role definitions.
 */
export function detectExistingRoles(root: string): DetectedRole[] {
  const detected: DetectedRole[] = [];

  // 1. Look for role-like directories (contain ROLE.md, prompt.md, system.md, etc.)
  scanRoleDirectories(root, detected);

  // 2. CLAUDE.md files (Claude Code project instructions)
  scanClaudeMd(root, detected);

  // 3. Prompt files / agent config files in common locations
  scanPromptFiles(root, detected);

  // 4. Cursor rules
  scanCursorRules(root, detected);

  return detected;
}

/** Max file size to read (50KB) */
const MAX_FILE_SIZE = 50 * 1024;

function safeRead(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) return null;
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function addIfExists(filePath: string, root: string, source: DetectedRole["source"], detected: DetectedRole[]): void {
  if (!exists(filePath)) return;
  const content = safeRead(filePath);
  if (!content?.trim()) return;
  detected.push({ path: path.relative(root, filePath), content, source });
}

function scanRoleDirectories(root: string, detected: DetectedRole[]): void {
  // Common patterns for role directories
  const roleDirPatterns = [
    "roles", "agents", "prompts", "sessions",
    ".roles", ".agents", ".sessions",
    "config/roles", "config/agents", ".config/roles",
  ];

  for (const pattern of roleDirPatterns) {
    const dir = path.join(root, pattern);
    if (!exists(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          // Check if it's a role-like markdown/yaml file
          if (/\.(md|yaml|yml|txt)$/i.test(entry.name)) {
            addIfExists(path.join(dir, entry.name), root, "role-dir", detected);
          }
          continue;
        }
        // Look inside each subdirectory for role definition files
        const subDir = path.join(dir, entry.name);
        const roleFiles = ["ROLE.md", "role.md", "prompt.md", "system.md", "instructions.md", "README.md"];
        for (const rf of roleFiles) {
          addIfExists(path.join(subDir, rf), root, "role-dir", detected);
        }
        // Also check for yaml/json config
        for (const cf of ["config.yaml", "config.yml", "role.yaml", "role.yml", "config.json"]) {
          addIfExists(path.join(subDir, cf), root, "role-dir", detected);
        }
      }
    } catch { /* skip unreadable dirs */ }
  }
}

function scanClaudeMd(root: string, detected: DetectedRole[]): void {
  addIfExists(path.join(root, "CLAUDE.md"), root, "claude-md", detected);
  // Also check .claude/ directory for settings
  const claudeDir = path.join(root, ".claude");
  if (exists(claudeDir)) {
    try {
      const entries = fs.readdirSync(claudeDir);
      for (const entry of entries) {
        if (/\.(md|yaml|yml|json)$/i.test(entry)) {
          addIfExists(path.join(claudeDir, entry), root, "claude-md", detected);
        }
      }
    } catch { /* skip */ }
  }
}

function scanPromptFiles(root: string, detected: DetectedRole[]): void {
  // Root-level prompt/agent files
  const rootPatterns = [
    "agents.md", "agents.yaml", "agents.yml",
    "system-prompt.md", "system.md",
    "AGENTS.md", "PROMPT.md",
  ];
  for (const p of rootPatterns) {
    addIfExists(path.join(root, p), root, "prompt-file", detected);
  }
}

function scanCursorRules(root: string, detected: DetectedRole[]): void {
  addIfExists(path.join(root, ".cursorrules"), root, "agent-config", detected);
  addIfExists(path.join(root, ".cursor", "rules"), root, "agent-config", detected);
  // .cursor/rules/ directory
  const cursorRulesDir = path.join(root, ".cursor", "rules");
  if (exists(cursorRulesDir)) {
    try {
      const stat = fs.statSync(cursorRulesDir);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(cursorRulesDir);
        for (const entry of entries) {
          if (/\.(md|mdc|txt)$/i.test(entry)) {
            addIfExists(path.join(cursorRulesDir, entry), root, "agent-config", detected);
          }
        }
      }
    } catch { /* skip */ }
  }
}

/**
 * Generate a bootstrap context document from detected roles.
 * This will be placed in .evomesh/ for the lead role to analyze.
 */
export function generateBootstrapContext(
  projectName: string,
  detected: DetectedRole[],
): string {
  let doc = `# ${projectName} — 角色引导上下文

> 本文件由 \`evomesh init\` 自动生成，包含在项目中检测到的已有角色设计。
> Lead 角色应在首次 Loop 时分析本文件，结合 EvoMesh 模板设计适合本项目的角色。
> 角色设计完成后可删除本文件。

## 检测到的角色设计文件

`;

  for (const role of detected) {
    doc += `### \`${role.path}\` (来源: ${role.source})\n\n`;
    doc += "```\n";
    doc += role.content.length > 3000
      ? role.content.slice(0, 3000) + "\n... (truncated)\n"
      : role.content;
    doc += "\n```\n\n";
  }

  doc += `## EvoMesh 角色设计指南

基于以上已有设计，Lead 角色应：

1. **分析已有角色** — 理解每个角色的职责、技能、边界
2. **映射到 EvoMesh 角色类型** — lead (总控) 或 worker (执行)
3. **继承项目特定内容** — 已有角色中针对本项目的提示词、规范、约束应保留
4. **融合 EvoMesh 协议** — 自我演进、协作网格、记忆系统等 EvoMesh 核心协议必须包含
5. **创建角色** — 使用 \`evomesh role create <name> --from <template>\` 创建基础角色，然后修改 ROLE.md 融入项目特定内容

### 角色创建原则
- 必须有且只有一个 lead 角色
- Worker 角色数量根据已有设计中的职责分工决定
- 已有设计中的项目特定规范（代码风格、技术栈约束、业务规则等）应写入对应角色的 ROLE.md
- EvoMesh 的硬性规则（第三章）不可修改
`;

  return doc;
}
