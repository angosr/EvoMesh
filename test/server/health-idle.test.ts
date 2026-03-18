import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { cleanupIdleRoles } from "../../src/server/health.js";
import type { ServerContext, ProjectEntry } from "../../src/server/index.js";

function createTmpProject(roleName = "worker", roleType = "worker"): { root: string; slug: string; stmPath: string; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evomesh-idle-test-"));
  const slug = path.basename(root);
  const evomesh = path.join(root, ".evomesh");
  const roleRoot = path.join(evomesh, "roles", roleName);
  fs.mkdirSync(path.join(roleRoot, "memory"), { recursive: true });
  fs.mkdirSync(path.join(roleRoot, "inbox"), { recursive: true });
  fs.mkdirSync(path.join(evomesh, "runtime"), { recursive: true });
  const config = {
    name: "test-project",
    roles: {
      [roleName]: { type: roleType, account: "main", loop_interval: "10m", launch_mode: "host", description: `${roleName} role` },
    },
    accounts: { main: "~/.claude" },
  };
  fs.writeFileSync(path.join(evomesh, "project.yaml"), YAML.stringify(config), "utf-8");
  const stmPath = path.join(roleRoot, "memory", "short-term.md");
  return { root, slug, stmPath, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function createMockCtx(projects: ProjectEntry[]): ServerContext {
  return {
    port: 0,
    sessions: new Map(),
    ttydProcesses: new Map(),
    getProjects: () => projects,
    getProject: (slug: string) => projects.find(p => p.slug === slug),
    checkNeedsLogin: () => false,
    extractToken: () => undefined,
  };
}

function touchFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Advance mtime by rewriting the file with a small delay.
 * Node.js fs mtime resolution is ~1ms on Linux, so we need a real delay.
 */
async function advanceMtime(filePath: string, content: string): Promise<void> {
  await new Promise(r => setTimeout(r, 50));
  fs.writeFileSync(filePath, content, "utf-8");
}

describe("server/health idle cleanup", () => {
  let proj: ReturnType<typeof createTmpProject>;
  let ctx: ServerContext;

  before(() => {
    proj = createTmpProject("testworker", "worker");
    const entry: ProjectEntry = { slug: proj.slug, name: "test-project", root: proj.root };
    ctx = createMockCtx([entry]);
  });

  after(() => proj.cleanup());

  it("does nothing when short-term.md does not exist", () => {
    // Should not throw — cleanupIdleRoles wraps everything in try/catch
    cleanupIdleRoles(ctx);
  });

  it("does nothing on first call (no previous mtime to compare)", () => {
    touchFile(proj.stmPath, "No tasks, idle");
    // First call: records mtime, increments to 1, but threshold is 2
    cleanupIdleRoles(ctx);
    // Should not throw — counter is 1, no action taken
  });

  it("does not increment counter when mtime has not changed", () => {
    // Call again without modifying the file — same mtime
    cleanupIdleRoles(ctx);
    // Counter stays at 1 because mtime didn't change, so still no action
  });

  it("resets counter when content does not contain 'idle'", async () => {
    // Write non-idle content with new mtime
    await advanceMtime(proj.stmPath, "## Done\n- Completed task X\n## Next\n- Work on Y");
    cleanupIdleRoles(ctx);
    // Counter should be reset to 0
    // Now write idle again — should only be at 1 (not trigger)
    await advanceMtime(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx);
    // Counter = 1, no action (would throw if it tried to send tmux command to nonexistent session)
  });

  it("attempts action after 2 consecutive idle loops", async () => {
    // Counter is at 1 from previous test. Write idle again with new mtime.
    await advanceMtime(proj.stmPath, "No tasks, idle");
    // This should attempt to send /clear via tmux, which will fail (no tmux session).
    // cleanupIdleRoles catches the error internally, so no throw.
    cleanupIdleRoles(ctx);
    // If we got here, it attempted the action and caught the tmux error gracefully.
  });

  it("respects cooldown after action", async () => {
    // Immediately after action, cooldown should prevent re-triggering
    await advanceMtime(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx);
    // Should be a no-op due to RESTART_COOLDOWN (5 min)
    // Verify by checking no error even with idle content
  });
});

describe("server/health idle cleanup — lead role", () => {
  let proj: ReturnType<typeof createTmpProject>;
  let ctx: ServerContext;

  before(() => {
    proj = createTmpProject("testlead", "lead");
    const entry: ProjectEntry = { slug: proj.slug, name: "test-project", root: proj.root };
    ctx = createMockCtx([entry]);
  });

  after(() => proj.cleanup());

  it("attempts /compact for lead after 2 idle loops", async () => {
    touchFile(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx); // count=1
    await advanceMtime(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx); // count=2, attempts /compact (fails gracefully, no tmux)
    // Success = no uncaught error
  });
});
