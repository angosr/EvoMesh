import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { loadConfig } from "../config/loader.js";
import { roleDir, expandHome } from "../utils/paths.js";
import { loadWorkspace, saveWorkspace, addProject, slugify } from "../workspace/config.js";
import { smartInit } from "../workspace/smartInit.js";
import { exists, formatBytes } from "../utils/fs.js";
import { errorMessage } from "../utils/error.js";
import {
  isRoleRunning, sendInput, containerName,
} from "../process/container.js";
import { startRoleManaged, stopRoleManaged } from "./health.js";
import {
  hasMinProjectRole, getProjectRole, setProjectOwner, grantAccess, revokeAccess,
  listMembers, removeProject, loadAcl, saveAcl,
} from "./acl.js";
import type { ProjectRole } from "./acl.js";
import type { SessionInfo } from "./auth.js";
import { listUsers } from "./auth.js";
import type { ServerContext } from "./index.js";
import { registerRoleRoutes } from "./routes-roles.js";
import { registerAdminRoutes } from "./routes-admin.js";
import { registerFeedRoutes } from "./routes-feed.js";
import { registerClaimsRoutes } from "./routes-claims.js";
import { registerUsageRoutes } from "./routes-usage.js";

export const ROLE_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;


/**
 * Check if the request has a session with at least the given project role.
 * Returns true if authorized, sends 403 and returns false otherwise.
 */
/** Extract linuxUser from request session for multi-user scoping. */
export function reqLinuxUser(req: any): string | undefined {
  return (req._session as SessionInfo | undefined)?.linuxUser;
}

export function requireProjectRole(req: any, res: any, projectPath: string, minRole: ProjectRole): boolean {
  const session = req._session as SessionInfo | undefined;
  if (!session) { res.status(401).json({ error: "Not authenticated" }); return false; }
  if (hasMinProjectRole(session.username, session.role, projectPath, minRole)) return true;
  res.status(403).json({ error: "Insufficient project permissions" });
  return false;
}

/**
 * Ensure ACL has entries for all known projects. On first run, assigns
 * existing projects to the first admin user.
 */
function ensureAclMigration(ctx: ServerContext): void {
  const acl = loadAcl();
  const projects = ctx.getProjects();
  let changed = false;
  for (const p of projects) {
    const key = path.resolve(p.root);
    if (!acl.projects[key]) {
      // Find first admin user as default owner
      const users = listUsers();
      const admin = users.find(u => u.role === "admin");
      acl.projects[key] = { owner: admin?.username || "admin", members: [] };
      changed = true;
    }
  }
  if (changed) saveAcl(acl);
}

let _nextPort = 0;
export function allocatePort(ctx: ServerContext): number {
  if (_nextPort === 0) {
    // Initialize from existing state
    _nextPort = ctx.port + 1;
    for (const [, t] of ctx.ttydProcesses) { if (t.port >= _nextPort) _nextPort = t.port + 1; }
  }
  return _nextPort++;
}

// Refresh subscribers (SSE connections waiting for push)
const refreshSubscribers: Set<import("express").Response> = new Set();

export function registerRoutes(app: import("express").Express, ctx: ServerContext): void {

  // Run ACL migration on startup
  try { ensureAclMigration(ctx); } catch (e) { console.error("[routes] ACL migration failed:", e); }

  // --- Refresh: central AI calls this after operations, Web UI subscribes ---
  // Both require auth (enforced by middleware since they are /api/ paths)
  app.post("/api/refresh", (req, res) => {
    const session = (req as any)._session;
    if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
    for (const sub of refreshSubscribers) {
      try { sub.write(`data: {"type":"refresh"}\n\n`); } catch (e) { console.error("[refresh] SSE write failed:", e); }
    }
    res.json({ ok: true, subscribers: refreshSubscribers.size });
  });

  app.get("/api/refresh/subscribe", (req, res) => {
    const session = (req as any)._session;
    if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    refreshSubscribers.add(res);
    req.on("close", () => refreshSubscribers.delete(res));
  });

  // --- Projects ---

  app.get("/api/projects", (req, res) => {
    try {
      const session = (req as any)._session as SessionInfo | undefined;
      const projects = ctx.getProjects(session?.linuxUser);
      // Admin sees all; others see only accessible projects
      const accessible = session?.role === "admin"
        ? projects
        : projects.filter(p => {
            if (!session) return false;
            return hasMinProjectRole(session.username, session.role, p.root, "viewer");
          });
      const result = accessible.map(p => {
        let hasConfig = false, roleCount = 0;
        try { const c = loadConfig(p.root); hasConfig = true; roleCount = Object.keys(c.roles).length; } catch (e) { console.error(`[projects] Failed to load config for ${p.root}:`, e); }
        const myRole = session ? getProjectRole(session.username, session.role, p.root) : null;
        return { slug: p.slug, name: p.name, path: p.root, hasConfig, roleCount, myRole };
      });
      res.json({ projects: result });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  app.post("/api/projects/add", async (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
    // admin or user can create projects
    try {
      const { url, path: localPath, lang: reqLang } = req.body;
      const lang = (reqLang === "en" ? "en" : "zh") as "zh" | "en";
      let projectRoot: string, projectName: string;

      if (url && typeof url === "string") {
        const repoName = url.replace(/\.git$/, "").split("/").pop() || "project";
        projectRoot = path.join(os.homedir(), "work", repoName);
        projectName = repoName;
        if (!exists(projectRoot)) execFileSync("git", ["clone", url, projectRoot], { timeout: 60000 });
      } else if (localPath && typeof localPath === "string") {
        projectRoot = path.resolve(expandHome(localPath));
        const home = os.homedir();
        if (!projectRoot.startsWith(home + path.sep) && projectRoot !== home) {
          res.status(400).json({ error: "Path must be within home directory" });
          return;
        }
        projectName = path.basename(projectRoot);
        if (!fs.existsSync(projectRoot)) { res.status(400).json({ error: "Path does not exist" }); return; }
      } else { res.status(400).json({ error: "Provide url or path" }); return; }

      const config = smartInit(projectRoot, projectName, lang);
      addProject(projectName, projectRoot, lang);
      setProjectOwner(projectRoot, session.username);
      const slug = slugify(projectName);

      // Write init task for lead and start it
      const leadName = Object.entries(config.roles).find(([, rc]) => rc.type === "lead")?.[0];
      if (leadName) {
        const todoPath = path.join(roleDir(projectRoot, leadName), "todo.md");
        const initTask = lang === "en"
          ? `# ${leadName} — Tasks\n\n## P0 — Project Initialization\n\n1. **Analyze project structure**: Read codebase to understand what this project does\n2. **Design role strategy**: Decide if additional roles needed\n3. **Update blueprint.md and status.md**\n4. **Dispatch initial tasks to executor**\n`
          : `# ${leadName} — 待办任务\n\n## P0 — 项目初始化\n\n1. **分析项目结构**: 阅读代码库，理解项目\n2. **设计角色策略**: 判断是否需要额外角色\n3. **更新 blueprint.md 和 status.md**\n4. **向 executor 分派初始任务**\n`;
        fs.writeFileSync(todoPath, initTask, "utf-8");

        const rc = config.roles[leadName];
        const ttydPort = allocatePort(ctx);
        try {
          startRoleManaged(ctx, projectRoot, slug, leadName, rc, config, ttydPort);
        } catch (e: unknown) { console.error(`Failed to start lead:`, errorMessage(e)); }
      }

      res.json({ ok: true, project: { slug, name: projectName, path: projectRoot } });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  app.delete("/api/projects/:slug", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    // Stop all containers for this project
    try {
      const config = loadConfig(project.root);
      for (const roleName of Object.keys(config.roles)) {
        stopRoleManaged(ctx, project.root, project.slug, roleName, { reason: "project-deleted" });
      }
    } catch (e) { console.error(`[delete-project] Failed to stop roles for ${project.slug}:`, e); }
    removeProject(project.root);
    const ws = loadWorkspace();
    ws.projects = ws.projects.filter(p => path.resolve(p.path) !== project.root);
    saveWorkspace(ws);
    res.json({ ok: true });
  });

  // --- Project status ---

  app.get("/api/projects/:slug/status", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "viewer")) return;
    try {
      const config = loadConfig(project.root);
      const roles = Object.entries(config.roles).map(([name, rc]) => {
        const running = isRoleRunning(project.root, name);
        const key = `${project.slug}/${name}`;
        const ttyd = ctx.ttydProcesses.get(key);
        const accountDir = expandHome(config.accounts[rc.account] || "~/.claude");
        let actualMem: string | null = null, actualCpu: string | null = null;
        if (running) {
          const lu = reqLinuxUser(req) || process.env.USER || "user";
          const cname = containerName(slugify(path.basename(project.root)), name, lu);
          const cached = (ctx as any).statsCache?.get(cname);
          if (cached) { actualMem = cached.mem || null; actualCpu = cached.cpu || null; }
        }
        return {
          name, type: rc.type, loop_interval: rc.loop_interval, description: rc.description,
          running, terminal: ttyd ? `/terminal/${project.slug}/${name}/` : null,
          account: rc.account, needsLogin: ctx.checkNeedsLogin(accountDir),
          memory: rc.memory || null, cpus: rc.cpus || null, launch_mode: rc.launch_mode || "docker",
          idle_policy: rc.idle_policy || "ignore",
          model: rc.model || "sonnet",
          actualMem, actualCpu,
        };
      });
      const session = (req as any)._session as SessionInfo | undefined;
      const myRole = session ? getProjectRole(session.username, session.role, project.root) : null;
      res.json({ project: project.name, slug: project.slug, roles, accounts: config.accounts, myRole });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Chat ---

  app.post("/api/projects/:slug/chat", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "member")) return;
    const { message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) { res.status(400).json({ error: "Empty" }); return; }
    try {
      const config = loadConfig(project.root);
      const leadName = Object.entries(config.roles).find(([, rc]) => rc.type === "lead")?.[0];
      if (!leadName) { res.status(404).json({ error: "No lead role" }); return; }

      // Write to inbox
      const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
      const inboxPath = path.join(roleDir(project.root, leadName), "inbox", `${ts}_user_chat.md`);
      fs.mkdirSync(path.dirname(inboxPath), { recursive: true });
      fs.writeFileSync(inboxPath, `---\nfrom: user\npriority: high\ntype: chat\n---\n\n${message.trim()}\n`, "utf-8");

      // Send to running container
      sendInput(project.root, leadName, `[用户消息] ${message.trim()}`);

      res.json({ ok: true, delivered_to: leadName });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  app.get("/api/projects/:slug/chat/history", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project) { res.json({ messages: [] }); return; }
    if (!requireProjectRole(req, res, project.root, "viewer")) return;
    try {
      const config = loadConfig(project.root);
      const leadName = Object.entries(config.roles).find(([, rc]) => rc.type === "lead")?.[0];
      if (!leadName) { res.json({ messages: [] }); return; }
      const readMsgs = (dir: string, processed: boolean) => {
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir).filter(f => f.includes("_user_chat.md")).sort().slice(-50).map(f => {
          const body = fs.readFileSync(path.join(dir, f), "utf-8").split("---").slice(2).join("---").trim();
          return { ts: f.slice(0, 15), from: "user", body, processed };
        });
      };
      const inbox = path.join(roleDir(project.root, leadName), "inbox");
      const msgs = [...readMsgs(inbox, false), ...readMsgs(path.join(inbox, "processed"), true)].sort((a, b) => a.ts.localeCompare(b.ts));
      res.json({ messages: msgs });
    } catch (e) { console.error("[chat/history] Failed to read chat history:", e); res.json({ messages: [] }); }
  });

  // --- SSE feed ---

  app.get("/api/feed", (req, res) => {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const gather = () => {
      try {
        const projects = ctx.getProjects(session.linuxUser);
        const allEntries: Array<{ project: string; slug: string; role: string; type: string; running: boolean; status: string }> = [];
        for (const p of projects) {
          try {
            const config = loadConfig(p.root);
            for (const [name, rc] of Object.entries(config.roles)) {
              const running = isRoleRunning(p.root, name);
              let status = running ? "Running" : "Stopped";
              try {
                const stm = fs.readFileSync(path.join(roleDir(p.root, name), "memory", "short-term.md"), "utf-8");
                const bullets = stm.match(/^- .+$/gm);
                if (bullets?.length) {
                  const recent = bullets.filter(b => !b.startsWith("- 下一")).pop() || bullets[bullets.length - 1];
                  status = recent.replace(/^- /, "");
                }
              } catch (e) { /* short-term.md may not exist yet — non-critical */ }
              allEntries.push({ project: p.name, slug: p.slug, role: name, type: rc.type, running, status });
            }
          } catch (e) { console.error(`[feed] Failed to load config for ${p.root}:`, e); }
        }
        res.write(`data: ${JSON.stringify({ type: "status", entries: allEntries, ts: new Date().toISOString() })}\n\n`);
      } catch (e) { console.error("[feed] gather error:", e); }
    };
    gather();
    const timer = setInterval(gather, 5000);
    const maxLifetime = setTimeout(() => { clearInterval(timer); try { res.end(); } catch {} }, 30 * 60 * 1000);
    req.on("close", () => { clearInterval(timer); clearTimeout(maxLifetime); });
  });

  // Accounts, usage, metrics → routes-usage.ts

  // --- Project members ---

  app.get("/api/projects/:slug/members", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "viewer")) return;
    const members = listMembers(project.root);
    res.json(members || { owner: "", members: [] });
  });

  app.post("/api/projects/:slug/members", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const { username, role } = req.body;
    if (!username || !USERNAME_RE.test(username)) { res.status(400).json({ error: "Invalid username" }); return; }
    if (role !== "member" && role !== "viewer") { res.status(400).json({ error: "Role must be 'member' or 'viewer'" }); return; }
    try {
      grantAccess(project.root, username, role);
      res.json({ ok: true, username, role });
    } catch (e: unknown) { res.status(400).json({ error: errorMessage(e) }); }
  });

  app.delete("/api/projects/:slug/members/:username", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    try {
      revokeAccess(project.root, req.params.username);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(400).json({ error: errorMessage(e) }); }
  });

  // --- Backward compat ---

  app.get("/api/status", (req, res) => {
    const projects = ctx.getProjects(reqLinuxUser(req));
    if (projects.length === 0) { res.json({ project: "none", roles: [] }); return; }
    res.redirect(`/api/projects/${projects[0].slug}/status`);
  });

  // --- Register extracted route groups ---
  registerRoleRoutes(app, ctx);
  registerUsageRoutes(app, ctx);
  registerFeedRoutes(app, ctx);
  registerClaimsRoutes(app, ctx);
  registerAdminRoutes(app, ctx);
}
