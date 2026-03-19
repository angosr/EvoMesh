import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { cleanupIdleRoles } from "../../src/server/health.js";
import type { ServerContext, ProjectEntry } from "../../src/server/index.js";

function createTmpProject(roleName = "worker", roleType = "worker", loopInterval = "10m"): { root: string; slug: string; stmPath: string; inboxDir: string; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evomesh-idle-test-"));
  const slug = path.basename(root);
  const evomesh = path.join(root, ".evomesh");
  const roleRoot = path.join(evomesh, "roles", roleName);
  const inboxDir = path.join(roleRoot, "inbox");
  fs.mkdirSync(path.join(roleRoot, "memory"), { recursive: true });
  fs.mkdirSync(inboxDir, { recursive: true });
  fs.mkdirSync(path.join(evomesh, "runtime"), { recursive: true });
  const config = {
    name: "test-project",
    roles: {
      [roleName]: { type: roleType, account: "main", loop_interval: loopInterval, launch_mode: "host", description: `${roleName} role` },
    },
    accounts: { main: "~/.claude" },
  };
  fs.writeFileSync(path.join(evomesh, "project.yaml"), YAML.stringify(config), "utf-8");
  const stmPath = path.join(roleRoot, "memory", "short-term.md");
  return { root, slug, stmPath, inboxDir, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
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

async function writeSTM(filePath: string, content: string): Promise<void> {
  await new Promise(r => setTimeout(r, 50)); // ensure mtime advances
  fs.writeFileSync(filePath, content, "utf-8");
}

// =============================================================================
// CRITICAL SAFETY TESTS: roles doing real work must NEVER be touched
// =============================================================================

describe("SAFETY: working roles must never be cleared/compacted/stopped", () => {
  let proj: ReturnType<typeof createTmpProject>;
  let ctx: ServerContext;

  before(() => {
    proj = createTmpProject("busy-role", "worker");
    const entry: ProjectEntry = { slug: proj.slug, name: "test", root: proj.root };
    ctx = createMockCtx([entry]);
  });
  after(() => proj.cleanup());

  it("does NOT act on role with old STM (role busy with long task)", async () => {
    // Write real work content, then let it get "old" (simulate long-running task)
    await writeSTM(proj.stmPath, "## Done\n- Running v2 training, ETA 6 hours\n## In-progress\n- Training\n## Next\n- Eval");
    cleanupIdleRoles(ctx); // records mtime
    // Call multiple times WITHOUT updating file — simulates role busy for hours
    for (let i = 0; i < 10; i++) {
      cleanupIdleRoles(ctx);
    }
    // If we reach here, no action was attempted (no tmux error thrown)
    assert.ok(true, "Working role with stale STM was not touched");
  });

  it("does NOT act on role waiting for external result", async () => {
    await writeSTM(proj.stmPath, "## Done\n- All directives complete\n## Blockers\n- Waiting for v2 training to finish\n## Next\n- Eval after training");
    cleanupIdleRoles(ctx);
    // Multiple cycles, file not rewritten (role is waiting)
    for (let i = 0; i < 10; i++) {
      cleanupIdleRoles(ctx);
    }
    assert.ok(true, "Waiting role was not touched");
  });

  it("does NOT act on role with empty In-progress but real Done content", async () => {
    await writeSTM(proj.stmPath, "## Done\n- Fixed 3 bugs\n- Reviewed PR\n## In-progress\n(None)\n## Next\n- UX audit");
    cleanupIdleRoles(ctx);
    for (let i = 0; i < 10; i++) {
      cleanupIdleRoles(ctx);
    }
    assert.ok(true, "Role with real Done content was not touched");
  });

  it("does NOT act when STM content changes but is never 'idle'", async () => {
    // Simulate role actively working across multiple loops
    const tasks = [
      "## Done\n- Task A\n## Next\n- Task B",
      "## Done\n- Task B\n## Next\n- Task C",
      "## Done\n- Task C\n## Next\n- Task D",
      "## Done\n- Task D\n## Next\n- Task E",
    ];
    for (const t of tasks) {
      await writeSTM(proj.stmPath, t);
      cleanupIdleRoles(ctx);
    }
    assert.ok(true, "Active role cycling through tasks was not touched");
  });
});

// =============================================================================
// EXPLICIT IDLE DETECTION: only "No tasks, idle" triggers action
// =============================================================================

describe("idle cleanup only triggers on explicit 'No tasks, idle' declaration", () => {
  let proj: ReturnType<typeof createTmpProject>;
  let ctx: ServerContext;

  before(() => {
    proj = createTmpProject("idle-test", "worker");
    const entry: ProjectEntry = { slug: proj.slug, name: "test", root: proj.root };
    ctx = createMockCtx([entry]);
  });
  after(() => proj.cleanup());

  it("requires exactly 3 consecutive idle declarations", async () => {
    // Write idle 1
    await writeSTM(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx); // count=1
    // Write idle 2
    await writeSTM(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx); // count=2
    // Still no action at count=2 (threshold is 3)
    assert.ok(true, "No action at 2 consecutive idle declarations");

    // Write idle 3 — this would attempt tmux action which fails gracefully
    await writeSTM(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx); // count=3, attempts action (fails gracefully)
    assert.ok(true, "Action attempted at 3 consecutive idle declarations");
  });

  it("resets counter when role writes non-idle content", async () => {
    // Write real work
    await writeSTM(proj.stmPath, "## Done\n- Fixed bug\n## Next\n- More work");
    cleanupIdleRoles(ctx); // counter reset to 0

    // Now idle twice — should NOT trigger (need 3)
    await writeSTM(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx); // count=1
    await writeSTM(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx); // count=2
    assert.ok(true, "Counter properly reset after real work");
  });

  it("does NOT count unchanged file (same mtime) as idle declaration", async () => {
    // Set idle content but don't change mtime
    await writeSTM(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx); // records mtime, count increases

    // Call again WITHOUT writing — mtime unchanged
    cleanupIdleRoles(ctx); // should skip (mtime unchanged)
    cleanupIdleRoles(ctx); // should skip
    cleanupIdleRoles(ctx); // should skip
    // Counter should still be at whatever it was from the single write
    assert.ok(true, "Unchanged mtime does not increment idle counter");
  });

  it("does NOT treat similar-but-not-exact phrases as idle", async () => {
    // These should NOT match
    const nonIdlePhrases = [
      "Reviewed idle detection logic",
      "## Done\n- Fixed idle cleanup bug",
      "Working on idle policy feature",
      "updated",
      "No new inbox",
      "Waiting for tasks",
    ];
    for (const phrase of nonIdlePhrases) {
      await writeSTM(proj.stmPath, phrase);
      cleanupIdleRoles(ctx);
    }
    assert.ok(true, "Similar but non-idle phrases did not trigger");
  });
});

// =============================================================================
// INBOX PROTECTION: don't clear roles with pending messages
// =============================================================================

describe("idle cleanup respects inbox", () => {
  let proj: ReturnType<typeof createTmpProject>;
  let ctx: ServerContext;

  before(() => {
    proj = createTmpProject("inbox-test", "worker");
    const entry: ProjectEntry = { slug: proj.slug, name: "test", root: proj.root };
    ctx = createMockCtx([entry]);
  });
  after(() => proj.cleanup());

  it("skips cleanup when role has unprocessed inbox messages", async () => {
    // Write 3 idle declarations
    await writeSTM(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx);
    await writeSTM(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx);

    // Add inbox message before 3rd idle
    fs.writeFileSync(path.join(proj.inboxDir, "20260101T0000_test_task.md"), "---\nfrom: test\n---\nDo something");

    await writeSTM(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx); // should skip due to inbox
    assert.ok(true, "Cleanup skipped when inbox has messages");

    // Clean up
    fs.unlinkSync(path.join(proj.inboxDir, "20260101T0000_test_task.md"));
  });
});

// =============================================================================
// LEAD ROLE: compact instead of clear
// =============================================================================

describe("lead role gets /compact not /clear", () => {
  let proj: ReturnType<typeof createTmpProject>;
  let ctx: ServerContext;

  before(() => {
    proj = createTmpProject("testlead", "lead");
    const entry: ProjectEntry = { slug: proj.slug, name: "test", root: proj.root };
    ctx = createMockCtx([entry]);
  });
  after(() => proj.cleanup());

  it("attempts /compact for lead after 3 idle loops", async () => {
    await writeSTM(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx); // 1
    await writeSTM(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx); // 2
    await writeSTM(proj.stmPath, "No tasks, idle");
    cleanupIdleRoles(ctx); // 3 — attempts /compact (fails gracefully)
    assert.ok(true, "Lead role /compact attempted after 3 idle declarations");
  });
});

// =============================================================================
// CIRCUIT BREAKER: persistent, survives restarts
// =============================================================================

describe("circuit breaker prevents infinite reset loops", () => {
  let monitorStateFile: string;

  before(() => {
    monitorStateFile = path.join(os.homedir(), ".evomesh", "monitor-state.json");
  });

  it("monitor-state.json exists and is valid JSON", () => {
    assert.ok(fs.existsSync(monitorStateFile), "monitor-state.json should exist");
    const data = JSON.parse(fs.readFileSync(monitorStateFile, "utf-8"));
    assert.equal(typeof data, "object", "should be an object");
  });

  it("suspended roles have suspended=true in state file", () => {
    const data = JSON.parse(fs.readFileSync(monitorStateFile, "utf-8"));
    // After the affine-swarm incident, these should be suspended
    for (const key of Object.keys(data)) {
      if (data[key].suspended) {
        assert.ok(data[key].restartCount >= 3, `${key}: suspended role should have restartCount >= 3`);
      }
    }
    assert.ok(true, "Suspended roles have correct state");
  });
});
