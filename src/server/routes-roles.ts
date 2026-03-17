import path from "node:path";
import { loadConfig } from "../config/loader.js";
import { evomeshDir, expandHome } from "../utils/paths.js";
import { writeYaml } from "../utils/fs.js";
import { errorMessage } from "../utils/error.js";
import { createRole, deleteRole, getTemplateNames } from "../roles/manager.js";
import {
  startRole, stopRole, restartRole, isRoleRunning,
  getRoleLogs, switchAccount as switchContainerAccount,
} from "../process/container.js";
import type { ServerContext } from "./index.js";
import type { SessionInfo } from "./auth.js";
import { ROLE_NAME_RE, requireProjectRole, allocatePort } from "./routes.js";
import { markRoleRunning, markRoleStopped } from "./health.js";

export function registerRoleRoutes(app: import("express").Express, ctx: ServerContext): void {

  // --- Role lifecycle ---

  app.post("/api/projects/:slug/roles/:name/start", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }

      // Allocate port
      const ttydPort = allocatePort(ctx);

      const result = startRole(project.root, roleName, rc, config, ttydPort);
      ctx.ttydProcesses.set(`${project.slug}/${roleName}`, { port: ttydPort, roleName, projectSlug: project.slug });
      markRoleRunning(`${project.slug}/${roleName}`);
      res.json({ ok: true, ...result });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  app.post("/api/projects/:slug/roles/:name/stop", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    stopRole(project.root, req.params.name);
    markRoleStopped(`${project.slug}/${req.params.name}`);
    // Mark as user-stopped so auto-restart doesn't revive it
    const key = `${project.slug}/${req.params.name}`;
    const entry = ctx.ttydProcesses.get(key);
    if (entry) { entry.userStopped = true; } else {
      ctx.ttydProcesses.set(key, { port: 0, roleName: req.params.name, projectSlug: project.slug, userStopped: true });
    }
    res.json({ ok: true });
  });

  app.post("/api/projects/:slug/roles/:name/restart", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }

      // If container exists, restart it. Otherwise start fresh.
      if (isRoleRunning(project.root, roleName)) {
        restartRole(project.root, roleName);
      } else {
        // Stop any dead container first
        stopRole(project.root, roleName);
        // Allocate port
        const ttydPort = allocatePort(ctx);
        startRole(project.root, roleName, rc, config, ttydPort);
        ctx.ttydProcesses.set(`${project.slug}/${roleName}`, { port: ttydPort, roleName, projectSlug: project.slug });
      }
      res.json({ ok: true, role: roleName });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Role logs ---

  app.get("/api/projects/:slug/roles/:name/log", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "viewer")) return;
    const logs = getRoleLogs(project.root, req.params.name);
    res.type("text").send(logs);
  });

  // --- Role CRUD ---

  app.get("/api/templates", (_req, res) => {
    res.json({ templates: getTemplateNames() });
  });

  app.post("/api/projects/:slug/roles", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const { name, template, account } = req.body;
    if (!name || !ROLE_NAME_RE.test(name)) { res.status(400).json({ error: "Invalid role name" }); return; }
    if (!template || !getTemplateNames().includes(template)) { res.status(400).json({ error: `Invalid template` }); return; }
    try {
      const config = loadConfig(project.root);
      if (config.roles[name]) { res.status(409).json({ error: `Role "${name}" already exists` }); return; }
      createRole(project.root, name, template, config, account || "main");
      res.json({ ok: true, role: name, template });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  app.delete("/api/projects/:slug/roles/:name", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const config = loadConfig(project.root);
      if (!config.roles[roleName]) { res.status(404).json({ error: "Role not found" }); return; }
      stopRole(project.root, roleName);
      ctx.ttydProcesses.delete(`${project.slug}/${roleName}`);
      deleteRole(project.root, roleName, config);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Resource config ---

  app.post("/api/projects/:slug/roles/:name/config", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }

      const { memory, cpus, launch_mode } = req.body;
      rc.memory = memory || undefined;
      rc.cpus = cpus || undefined;
      if (launch_mode === "docker" || launch_mode === "host") {
        rc.launch_mode = launch_mode;
      }
      writeYaml(path.join(evomeshDir(project.root), "project.yaml"), config);

      // Restart container with new limits if running
      const wasRunning = isRoleRunning(project.root, roleName);
      if (wasRunning) {
        stopRole(project.root, roleName);
        ctx.ttydProcesses.delete(`${project.slug}/${roleName}`);
        const ttydPort = allocatePort(ctx);
        const fresh = loadConfig(project.root);
        startRole(project.root, roleName, fresh.roles[roleName], fresh, ttydPort);
        ctx.ttydProcesses.set(`${project.slug}/${roleName}`, { port: ttydPort, roleName, projectSlug: project.slug });
      }

      res.json({ ok: true, memory: rc.memory, cpus: rc.cpus, restarted: wasRunning });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Account switching ---

  app.post("/api/projects/:slug/roles/:name/account", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const { accountName, accountPath: rawPath } = req.body;
      if (!accountName) { res.status(400).json({ error: "Missing accountName" }); return; }
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }
      if (rawPath && !config.accounts[accountName]) config.accounts[accountName] = rawPath;
      if (!config.accounts[accountName]) { res.status(400).json({ error: "Account not found" }); return; }

      const oldAccount = rc.account;
      rc.account = accountName;
      writeYaml(path.join(evomeshDir(project.root), "project.yaml"), config);

      // Swap credentials in container config (preserves session)
      const newAccountPath = expandHome(config.accounts[accountName]);
      switchContainerAccount(project.root, roleName, newAccountPath);

      // Restart container to pick up new credentials
      const wasRunning = isRoleRunning(project.root, roleName);
      if (wasRunning) restartRole(project.root, roleName);

      res.json({ ok: true, oldAccount, newAccount: accountName, restarted: wasRunning });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });
}
