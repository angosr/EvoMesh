import path from "node:path";
import os from "node:os";
import { loadConfig } from "../config/loader.js";
import { evomeshDir, expandHome } from "../utils/paths.js";
import { writeYaml } from "../utils/fs.js";
import { errorMessage } from "../utils/error.js";
import { createRole, deleteRole, getTemplateNames } from "../roles/manager.js";
import {
  restartRole, isRoleRunning,
  getRoleLogs, switchAccount as switchContainerAccount,
} from "../process/container.js";
import type { ServerContext } from "./index.js";
import type { SessionInfo } from "./auth.js";
import { ROLE_NAME_RE, requireProjectRole, allocatePort, reqLinuxUser } from "./routes.js";
import { startRoleManaged, stopRoleManaged, recordRoleStart } from "./health.js";

export function registerRoleRoutes(app: import("express").Express, ctx: ServerContext): void {

  // --- Role lifecycle ---

  app.post("/api/projects/:slug/roles/:name/start", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }
      const ttydPort = allocatePort(ctx);
      const result = startRoleManaged(ctx, project.root, project.slug, roleName, rc, config, ttydPort);
      res.json({ ok: true, ...result });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  app.post("/api/projects/:slug/roles/:name/stop", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    stopRoleManaged(ctx, project.root, project.slug, req.params.name, { userStopped: true });
    res.json({ ok: true });
  });

  app.post("/api/projects/:slug/roles/:name/restart", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }

      if (isRoleRunning(project.root, roleName)) {
        restartRole(project.root, roleName);
        recordRoleStart(`${project.slug}/${roleName}`);
      } else {
        // Stop any dead container first, then start fresh
        stopRoleManaged(ctx, project.root, project.slug, roleName, { keepDesiredState: true });
        const ttydPort = allocatePort(ctx);
        startRoleManaged(ctx, project.root, project.slug, roleName, rc, config, ttydPort);
      }
      res.json({ ok: true, role: roleName });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Role logs ---

  app.get("/api/projects/:slug/roles/:name/log", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
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
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
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
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const config = loadConfig(project.root);
      if (!config.roles[roleName]) { res.status(404).json({ error: "Role not found" }); return; }
      stopRoleManaged(ctx, project.root, project.slug, roleName);
      deleteRole(project.root, roleName, config);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Resource config ---

  app.post("/api/projects/:slug/roles/:name/config", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
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
        stopRoleManaged(ctx, project.root, project.slug, roleName, { keepDesiredState: true });
        const ttydPort = allocatePort(ctx);
        const fresh = loadConfig(project.root);
        startRoleManaged(ctx, project.root, project.slug, roleName, fresh.roles[roleName], fresh, ttydPort);
      }

      res.json({ ok: true, memory: rc.memory, cpus: rc.cpus, restarted: wasRunning });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Account switching ---

  app.post("/api/projects/:slug/roles/:name/account", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const { accountName, accountPath: rawPath } = req.body;
      if (!accountName) { res.status(400).json({ error: "Missing accountName" }); return; }
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }
      if (rawPath && !config.accounts[accountName]) {
        // Validate account path stays within home directory
        const resolved = path.resolve(expandHome(rawPath));
        const homeDir = os.homedir();
        if (!resolved.startsWith(homeDir + path.sep) && resolved !== homeDir) {
          res.status(400).json({ error: "Account path must be within home directory" }); return;
        }
        config.accounts[accountName] = rawPath;
      }
      if (!config.accounts[accountName]) { res.status(400).json({ error: "Account not found" }); return; }

      const oldAccount = rc.account;
      rc.account = accountName;
      writeYaml(path.join(evomeshDir(project.root), "project.yaml"), config);

      // Swap credentials in container config (preserves session)
      const newAccountPath = expandHome(config.accounts[accountName]);
      switchContainerAccount(project.root, roleName, newAccountPath);

      // Restart container to pick up new credentials
      const wasRunning = isRoleRunning(project.root, roleName);
      if (wasRunning) {
        restartRole(project.root, roleName);
        recordRoleStart(`${project.slug}/${roleName}`);
      }

      res.json({ ok: true, oldAccount, newAccount: accountName, restarted: wasRunning });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });
}
