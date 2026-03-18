import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ensureDir } from "../utils/fs.js";

/**
 * Return true if src is newer than dest, or if dest doesn't exist.
 * Handles TOCTOU races where dest is deleted between existence check and stat.
 */
function isNewer(src: string, dest: string): boolean {
  try {
    const srcStat = fs.statSync(src);
    const destStat = fs.statSync(dest);
    return srcStat.mtimeMs > destStat.mtimeMs;
  } catch {
    return true; // dest doesn't exist or src missing — copy anyway
  }
}

/**
 * Bootstrap ~/.evomesh/ on first run.
 * Creates skeleton directories, default workspace config, central AI role, and templates.
 * Skips anything that already exists.
 */
export function bootstrapGlobalConfig(): void {
  const evomeshDir = path.join(os.homedir(), ".evomesh");
  const isFirstRun = !fs.existsSync(path.join(evomeshDir, "workspace.yaml"));

  if (isFirstRun) {
    console.log("[bootstrap] First run detected — creating ~/.evomesh/ skeleton...");
  }

  // Core directories (always ensure)
  ensureDir(evomeshDir);
  ensureDir(path.join(evomeshDir, "central", "memory"));
  ensureDir(path.join(evomeshDir, "central", "inbox"));
  ensureDir(path.join(evomeshDir, "templates"));

  // Empty workspace config (first run only)
  const wsFile = path.join(evomeshDir, "workspace.yaml");
  if (!fs.existsSync(wsFile)) {
    fs.writeFileSync(wsFile, "projects: []\n", "utf-8");
  }

  // Central AI ROLE.md — sync from repo defaults/ (copy if newer or missing)
  const centralRole = path.join(evomeshDir, "central", "ROLE.md");
  const repoDefault = findRepoFile("defaults/central-role.md");
  if (repoDefault) {
    if (!fs.existsSync(centralRole)) {
      fs.copyFileSync(repoDefault, centralRole);
      console.log("[bootstrap] Created central AI ROLE.md");
    } else {
      // Auto-sync: if defaults is newer than live, overwrite
      const defaultMtime = fs.statSync(repoDefault).mtimeMs;
      const liveMtime = fs.statSync(centralRole).mtimeMs;
      if (defaultMtime > liveMtime) {
        fs.copyFileSync(repoDefault, centralRole);
        console.log("[bootstrap] Synced central AI ROLE.md from defaults (newer)");
      }
    }
  }

  // Central AI CLAUDE.md — auto-loaded by Claude Code when cwd is ~/.evomesh/central/
  const centralClaude = path.join(evomeshDir, "central", "CLAUDE.md");
  const repoClaude = findRepoFile("defaults/central-claude.md");
  if (repoClaude) {
    if (isNewer(repoClaude, centralClaude)) {
      fs.copyFileSync(repoClaude, centralClaude);
      console.log("[bootstrap] Synced central AI CLAUDE.md");
    }
  }

  // Central AI todo.md
  const centralTodo = path.join(evomeshDir, "central", "todo.md");
  if (!fs.existsSync(centralTodo)) {
    fs.writeFileSync(centralTodo, "# Central AI — Tasks\n\n## P0 — Immediate\n\n(All clear)\n", "utf-8");
  }

  // Central AI memory
  const centralStm = path.join(evomeshDir, "central", "memory", "short-term.md");
  if (!fs.existsSync(centralStm)) {
    fs.writeFileSync(centralStm, "# Short-term Memory\n\n(empty)\n", "utf-8");
  }

  // Copy templates from repo .evomesh/templates/ to ~/.evomesh/templates/
  copyTemplatesIfMissing();

  // Deploy Claude Code hooks (.claude/settings.json) for compliance enforcement
  const claudeDir = path.join(process.cwd(), ".claude");
  const hooksFile = path.join(claudeDir, "settings.json");
  const defaultHooks = findRepoFile("defaults/claude-settings.json");
  if (defaultHooks && isNewer(defaultHooks, hooksFile)) {
    ensureDir(claudeDir);
    fs.copyFileSync(defaultHooks, hooksFile);
    console.log("[bootstrap] Deployed Claude Code hooks (.claude/settings.json)");
  }

  // Generate AGENTS.md from CLAUDE.md (universal sections only)
  generateAgentsMd();

  console.log("[bootstrap] ~/.evomesh/ skeleton created");
}

/**
 * Extract universal rules from CLAUDE.md → AGENTS.md.
 * Skips EvoMesh-specific sections (Loop Flow, Communication, etc.)
 */
function generateAgentsMd(): void {
  const claudePath = path.join(process.cwd(), "CLAUDE.md");
  if (!fs.existsSync(claudePath)) return;
  try {
    const content = fs.readFileSync(claudePath, "utf-8");
    const sections = content.split(/^## /m).slice(1); // skip title
    const universalHeaders = ["Git", "Code Quality"];
    const universal = sections.filter(s =>
      universalHeaders.some(h => s.startsWith(h))
    );
    if (!universal.length) return;
    const agentsMd = `# AGENTS.md\n\n> Auto-generated from CLAUDE.md. Universal rules for any AI agent.\n\n${universal.map(s => "## " + s).join("\n")}`;
    const agentsPath = path.join(process.cwd(), "AGENTS.md");
    fs.writeFileSync(agentsPath, agentsMd, "utf-8");
    console.log("[bootstrap] Generated AGENTS.md from CLAUDE.md");
  } catch {}
}

/**
 * Copy bundled templates from defaults/templates/ to ~/.evomesh/templates/.
 * defaults/ ships with the tool — not project-specific.
 */
function copyTemplatesIfMissing(): void {
  const globalTemplates = path.join(os.homedir(), ".evomesh", "templates");
  let bundledTemplates = findRepoFile("defaults/templates");
  // Fallback: try process.cwd() (tsx --watch doesn't resolve import.meta.url correctly)
  if (!bundledTemplates || !fs.existsSync(bundledTemplates)) {
    const cwdCandidate = path.join(process.cwd(), "defaults", "templates");
    if (fs.existsSync(cwdCandidate)) bundledTemplates = cwdCandidate;
  }
  if (!bundledTemplates || !fs.existsSync(bundledTemplates)) {
    console.warn("[bootstrap] Templates source not found (defaults/templates/)");
    return;
  }
  copyDirRecursive(bundledTemplates, globalTemplates);
  console.log(`[bootstrap] Templates synced from ${bundledTemplates}`);
}

function copyDirRecursive(src: string, dest: string): void {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (isNewer(srcPath, destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Find a file relative to the repo root (walking up from this file's location).
 */
function findRepoFile(relPath: string): string | null {
  let dir = path.dirname(new URL(import.meta.url).pathname);
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, relPath);
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}
