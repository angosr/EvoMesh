import path from "node:path";
import fs from "node:fs";
import YAML from "yaml";
import { loadConfig } from "../config/loader.js";
import { evomeshDir } from "../utils/paths.js";
import { expandHome } from "../utils/paths.js";
import { createRole, deleteRole } from "../roles/manager.js";
import { TEMPLATES, TEMPLATE_NAMES } from "../roles/templates/index.js";
import {
  startRole, stopRole, restartRole, isRoleRunning,
  getRoleLogs, switchAccount as switchContainerAccount,
} from "../process/container.js";
import type { ServerContext } from "./index.js";
import type { SessionInfo } from "./auth.js";
import { ROLE_NAME_RE, requireProjectRole, allocatePort } from "./routes.js";

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
      res.json({ ok: true, ...result });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/projects/:slug/roles/:name/stop", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    stopRole(project.root, req.params.name);
    ctx.ttydProcesses.delete(`${project.slug}/${req.params.name}`);
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
    res.json({ templates: TEMPLATE_NAMES });
  });

  app.post("/api/projects/:slug/roles", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const { name, template, account } = req.body;
    if (!name || !ROLE_NAME_RE.test(name)) { res.status(400).json({ error: "Invalid role name" }); return; }
    if (!template || !TEMPLATES[template]) { res.status(400).json({ error: `Invalid template` }); return; }
    try {
      const config = loadConfig(project.root);
      if (config.roles[name]) { res.status(409).json({ error: `Role "${name}" already exists` }); return; }
      createRole(project.root, name, template, config, account || "main");
      res.json({ ok: true, role: name, template });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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

      const { memory, cpus } = req.body;
      rc.memory = memory || undefined;
      rc.cpus = cpus || undefined;
      fs.writeFileSync(path.join(evomeshDir(project.root), "project.yaml"), YAML.stringify(config), "utf-8");

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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
      fs.writeFileSync(path.join(evomeshDir(project.root), "project.yaml"), YAML.stringify(config), "utf-8");

      // Swap credentials in container config (preserves session)
      const newAccountPath = expandHome(config.accounts[accountName]);
      switchContainerAccount(project.root, roleName, newAccountPath);

      // Restart container to pick up new credentials
      const wasRunning = isRoleRunning(project.root, roleName);
      if (wasRunning) restartRole(project.root, roleName);

      res.json({ ok: true, oldAccount, newAccount: accountName, restarted: wasRunning });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
