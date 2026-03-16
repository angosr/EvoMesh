import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import YAML from "yaml";
import { registerRoutes } from "../../src/server/routes.js";
import type { ServerContext, ProjectEntry } from "../../src/server/index.js";

// --- Test helpers ---

function createTmpProject(): { root: string; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evomesh-routes-test-"));
  const evomesh = path.join(root, ".evomesh");
  fs.mkdirSync(path.join(evomesh, "roles", "lead", "inbox"), { recursive: true });
  fs.mkdirSync(path.join(evomesh, "roles", "lead", "memory"), { recursive: true });
  fs.mkdirSync(path.join(evomesh, "runtime"), { recursive: true });
  const config = {
    name: "test-project",
    roles: {
      lead: { type: "lead", account: "main", loop_interval: "10m", description: "Lead role" },
    },
    accounts: { main: "~/.claude" },
  };
  fs.writeFileSync(path.join(evomesh, "project.yaml"), YAML.stringify(config), "utf-8");
  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function createMockCtx(projects: ProjectEntry[] = []): ServerContext {
  return {
    port: 0,
    sessions: new Map(),
    ttydProcesses: new Map(),
    getProjects: () => projects,
    getProject: (slug: string) => projects.find(p => p.slug === slug),
    tmuxSession: (slug: string, roleName: string) => `evomesh-${slug}-${roleName}`,
    checkNeedsLogin: () => false,
    extractToken: () => undefined,
  };
}

async function startTestServer(ctx: ServerContext, sessionRole: "admin" | "user" = "admin"): Promise<{ baseUrl: string; server: http.Server }> {
  const app = express();
  app.use(express.json());
  // Inject mock session (simulates auth middleware)
  app.use((req, _res, next) => {
    (req as any)._session = { username: "testadmin", role: sessionRole };
    next();
  });
  registerRoutes(app, ctx);
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const addr = server.address() as { port: number };
  return { baseUrl: `http://127.0.0.1:${addr.port}`, server };
}

// --- Tests ---

describe("server/routes", () => {
  let tmp: ReturnType<typeof createTmpProject>;
  let projects: ProjectEntry[];
  let ctx: ServerContext;
  let baseUrl: string;
  let server: http.Server;

  before(async () => {
    tmp = createTmpProject();
    projects = [{ slug: "test-project", name: "test-project", root: tmp.root }];
    ctx = createMockCtx(projects);
    const s = await startTestServer(ctx);
    baseUrl = s.baseUrl;
    server = s.server;
  });

  after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    tmp.cleanup();
  });

  // --- GET /api/templates ---

  it("GET /api/templates returns template list", async () => {
    const res = await fetch(`${baseUrl}/api/templates`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.ok(Array.isArray(body.templates));
    assert.ok(body.templates.length > 0);
  });

  // --- GET /api/metrics ---

  it("GET /api/metrics returns cpu/memory/disk", async () => {
    const res = await fetch(`${baseUrl}/api/metrics`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.ok(typeof body.cpu.percent === "number");
    assert.ok(typeof body.cpu.cores === "number");
    assert.ok(typeof body.memory.percent === "number");
    assert.ok(typeof body.disk.percent === "number");
  });

  // --- GET /api/projects ---

  it("GET /api/projects returns project list with config info", async () => {
    const res = await fetch(`${baseUrl}/api/projects`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.projects.length, 1);
    assert.equal(body.projects[0].slug, "test-project");
    assert.equal(body.projects[0].hasConfig, true);
    assert.equal(body.projects[0].roleCount, 1);
  });

  it("GET /api/projects handles project with missing config", async () => {
    const badTmp = fs.mkdtempSync(path.join(os.tmpdir(), "evomesh-bad-"));
    const badCtx = createMockCtx([{ slug: "bad", name: "bad", root: badTmp }]);
    const s = await startTestServer(badCtx);
    try {
      const res = await fetch(`${s.baseUrl}/api/projects`);
      const body = await res.json() as any;
      assert.equal(body.projects[0].hasConfig, false);
      assert.equal(body.projects[0].roleCount, 0);
    } finally {
      await new Promise<void>(resolve => s.server.close(() => resolve()));
      fs.rmSync(badTmp, { recursive: true, force: true });
    }
  });

  // --- GET /api/projects/:slug/status ---

  it("GET /api/projects/:slug/status returns role info", async () => {
    const res = await fetch(`${baseUrl}/api/projects/test-project/status`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.project, "test-project");
    assert.equal(body.roles.length, 1);
    assert.equal(body.roles[0].name, "lead");
    assert.equal(body.roles[0].type, "lead");
    assert.equal(body.roles[0].running, false);
  });

  it("GET /api/projects/:slug/status returns 404 for unknown project", async () => {
    const res = await fetch(`${baseUrl}/api/projects/nonexistent/status`);
    assert.equal(res.status, 404);
  });

  // --- GET /api/projects/:slug/roles/:name/log ---

  it("GET /api/projects/:slug/roles/:name/log returns 200 with text", async () => {
    // Container-based: getRoleLogs returns empty string for non-running containers
    const res = await fetch(`${baseUrl}/api/projects/test-project/roles/lead/log`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(typeof text, "string");
  });

  it("GET /api/projects/:slug/roles/:name/log rejects invalid name", async () => {
    const res = await fetch(`${baseUrl}/api/projects/test-project/roles/bad%20name!/log`);
    assert.equal(res.status, 400);
  });

  // --- GET /api/status ---

  it("GET /api/status redirects to first project", async () => {
    const res = await fetch(`${baseUrl}/api/status`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.ok(res.headers.get("location")?.includes("test-project"));
  });

  it("GET /api/status returns empty when no projects", async () => {
    const emptyCtx = createMockCtx([]);
    const s = await startTestServer(emptyCtx);
    try {
      const res = await fetch(`${s.baseUrl}/api/status`);
      const body = await res.json() as any;
      assert.equal(body.project, "none");
    } finally {
      await new Promise<void>(resolve => s.server.close(() => resolve()));
    }
  });

  // --- GET /api/complete-path ---

  it("GET /api/complete-path returns directory suggestions", async () => {
    const res = await fetch(`${baseUrl}/api/complete-path?q=${encodeURIComponent("/tmp/")}`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.ok(Array.isArray(body.suggestions));
  });

  it("GET /api/complete-path returns empty for nonexistent path", async () => {
    const res = await fetch(`${baseUrl}/api/complete-path?q=${encodeURIComponent("/nonexistent_xyz_123/")}`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.deepEqual(body.suggestions, []);
  });

  it("GET /api/complete-path returns empty for empty query", async () => {
    const res = await fetch(`${baseUrl}/api/complete-path?q=`);
    const body = await res.json() as any;
    assert.deepEqual(body.suggestions, []);
  });

  // --- DELETE /api/projects/:slug ---

  it("DELETE /api/projects/:slug returns 404 for unknown project", async () => {
    const res = await fetch(`${baseUrl}/api/projects/nonexistent`, { method: "DELETE" });
    assert.equal(res.status, 404);
  });

  // --- POST /api/projects/:slug/chat ---

  it("POST /api/projects/:slug/chat rejects empty message", async () => {
    const res = await fetch(`${baseUrl}/api/projects/test-project/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    assert.equal(res.status, 400);
  });

  it("POST /api/projects/:slug/chat returns 404 for unknown project", async () => {
    const res = await fetch(`${baseUrl}/api/projects/nonexistent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    assert.equal(res.status, 404);
  });

  // --- POST /api/projects/:slug/roles ---

  it("POST /api/projects/:slug/roles rejects invalid role name", async () => {
    const res = await fetch(`${baseUrl}/api/projects/test-project/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "bad name!", template: "executor" }),
    });
    assert.equal(res.status, 400);
  });

  it("POST /api/projects/:slug/roles rejects invalid template", async () => {
    const res = await fetch(`${baseUrl}/api/projects/test-project/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "newrole", template: "nonexistent" }),
    });
    assert.equal(res.status, 400);
  });

  it("POST /api/projects/:slug/roles rejects duplicate role", async () => {
    const res = await fetch(`${baseUrl}/api/projects/test-project/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "lead", template: "executor" }),
    });
    assert.equal(res.status, 409);
  });

  // --- GET /api/accounts ---

  it("GET /api/accounts returns account list", async () => {
    const res = await fetch(`${baseUrl}/api/accounts`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.ok(Array.isArray(body.accounts));
  });

  // --- GET /api/projects/:slug/chat/history ---

  it("GET /api/projects/:slug/chat/history returns messages array", async () => {
    const res = await fetch(`${baseUrl}/api/projects/test-project/chat/history`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.ok(Array.isArray(body.messages));
  });

  it("GET /api/projects/:slug/chat/history returns empty for unknown project", async () => {
    const res = await fetch(`${baseUrl}/api/projects/nonexistent/chat/history`);
    const body = await res.json() as any;
    assert.deepEqual(body.messages, []);
  });

  // --- GET /api/projects/:slug/members ---

  it("GET /api/projects/:slug/members returns member list", async () => {
    const res = await fetch(`${baseUrl}/api/projects/test-project/members`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.ok("owner" in body);
    assert.ok(Array.isArray(body.members));
  });

  it("GET /api/projects/:slug/members returns 404 for unknown project", async () => {
    const res = await fetch(`${baseUrl}/api/projects/nonexistent/members`);
    assert.equal(res.status, 404);
  });

  // --- POST /api/projects/:slug/members ---

  it("POST /api/projects/:slug/members rejects invalid username", async () => {
    const res = await fetch(`${baseUrl}/api/projects/test-project/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bad name!", role: "member" }),
    });
    assert.equal(res.status, 400);
  });

  it("POST /api/projects/:slug/members rejects invalid role", async () => {
    const res = await fetch(`${baseUrl}/api/projects/test-project/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bob", role: "admin" }),
    });
    assert.equal(res.status, 400);
  });

  // --- Permission denial (non-admin user) ---

  it("non-owner user gets 403 on owner-only endpoints", async () => {
    // Create a server with a "user" session (not admin)
    const userCtx = createMockCtx(projects);
    const s = await startTestServer(userCtx, "user");
    try {
      // DELETE project requires owner
      const res = await fetch(`${s.baseUrl}/api/projects/test-project`, { method: "DELETE" });
      assert.equal(res.status, 403);
    } finally {
      await new Promise<void>(resolve => s.server.close(() => resolve()));
    }
  });

  it("non-owner user gets 403 on chat (member-only)", async () => {
    // "user" role without ACL entry → no project access → 403
    const userCtx = createMockCtx(projects);
    const s = await startTestServer(userCtx, "user");
    try {
      const res = await fetch(`${s.baseUrl}/api/projects/test-project/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      });
      assert.equal(res.status, 403);
    } finally {
      await new Promise<void>(resolve => s.server.close(() => resolve()));
    }
  });
});
