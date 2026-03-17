import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ensureDir } from "../utils/fs.js";

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

  console.log("[bootstrap] ~/.evomesh/ skeleton created");
}

/**
 * Copy bundled templates from defaults/templates/ to ~/.evomesh/templates/.
 * defaults/ ships with the tool — not project-specific.
 */
function copyTemplatesIfMissing(): void {
  const globalTemplates = path.join(os.homedir(), ".evomesh", "templates");
  const bundledTemplates = findRepoFile("defaults/templates");
  if (!bundledTemplates || !fs.existsSync(bundledTemplates)) return;

  copyDirRecursive(bundledTemplates, globalTemplates);
}

function copyDirRecursive(src: string, dest: string): void {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (!fs.existsSync(destPath) || fs.statSync(srcPath).mtimeMs > fs.statSync(destPath).mtimeMs) {
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
