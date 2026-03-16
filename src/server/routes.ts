import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { loadConfig } from "../config/loader.js";
import { roleDir, expandHome } from "../utils/paths.js";
import { loadWorkspace, saveWorkspace, addProject, slugify } from "../workspace/config.js";
import { smartInit } from "../workspace/smartInit.js";
import { exists } from "../utils/fs.js";
import {
  startRole, stopRole, isRoleRunning, sendInput,
} from "../process/container.js";
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

export const ROLE_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

export function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(0) + " KB";
  if (bytes < 1024 ** 3) return (bytes / (1024 ** 2)).toFixed(1) + " MB";
  return (bytes / (1024 ** 3)).toFixed(1) + " GB";
}

/**
 * Check if the request has a session with at least the given project role.
 * Returns true if authorized, sends 403 and returns false otherwise.
 */
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
  try { ensureAclMigration(ctx); } catch {}

  // --- Refresh: central AI calls this after operations, Web UI subscribes ---
  app.post("/api/refresh", (_req, res) => {
    // Notify all subscribed clients to refresh
    for (const sub of refreshSubscribers) {
      try { sub.write(`data: {"type":"refresh"}\n\n`); } catch {}
    }
    res.json({ ok: true, subscribers: refreshSubscribers.size });
  });

  app.get("/api/refresh/subscribe", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    refreshSubscribers.add(res);
    _req.on("close", () => refreshSubscribers.delete(res));
  });

  // --- Projects ---

  app.get("/api/projects", (req, res) => {
    try {
      const session = (req as any)._session as SessionInfo | undefined;
      const projects = ctx.getProjects();
      // Admin sees all; others see only accessible projects
      const accessible = session?.role === "admin"
        ? projects
        : projects.filter(p => {
            if (!session) return false;
            return hasMinProjectRole(session.username, session.role, p.root, "viewer");
          });
      const result = accessible.map(p => {
        let hasConfig = false, roleCount = 0;
        try { const c = loadConfig(p.root); hasConfig = true; roleCount = Object.keys(c.roles).length; } catch {}
        const myRole = session ? getProjectRole(session.username, session.role, p.root) : null;
        return { slug: p.slug, name: p.name, path: p.root, hasConfig, roleCount, myRole };
      });
      res.json({ projects: result });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
          startRole(projectRoot, leadName, rc, config, ttydPort);
          ctx.ttydProcesses.set(`${slug}/${leadName}`, { port: ttydPort, roleName: leadName, projectSlug: slug });
        } catch (e: any) { console.error(`Failed to start lead:`, e.message); }
      }

      res.json({ ok: true, project: { slug, name: projectName, path: projectRoot } });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/projects/:slug", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    // Stop all containers for this project
    try {
      const config = loadConfig(project.root);
      for (const roleName of Object.keys(config.roles)) {
        stopRole(project.root, roleName);
        ctx.ttydProcesses.delete(`${project.slug}/${roleName}`);
      }
    } catch {}
    removeProject(project.root);
    const ws = loadWorkspace();
    ws.projects = ws.projects.filter(p => path.resolve(p.path) !== project.root);
    saveWorkspace(ws);
    res.json({ ok: true });
  });

  // --- Project status ---

  app.get("/api/projects/:slug/status", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "viewer")) return;
    try {
      const config = loadConfig(project.root);
      const roles = Object.entries(config.roles).map(([name, rc]) => {
        const running = isRoleRunning(project.root, name);
        const key = `${project.slug}/${name}`;
        const ttyd = ctx.ttydProcesses.get(key);
        const accountDir = expandHome(config.accounts[rc.account] || "~/.claude");
        return {
          name, type: rc.type, loop_interval: rc.loop_interval, description: rc.description,
          running, terminal: ttyd ? `/terminal/${project.slug}/${name}/` : null,
          account: rc.account, needsLogin: ctx.checkNeedsLogin(accountDir),
          memory: rc.memory || null, cpus: rc.cpus || null,
        };
      });
      const session = (req as any)._session as SessionInfo | undefined;
      const myRole = session ? getProjectRole(session.username, session.role, project.root) : null;
      res.json({ project: project.name, slug: project.slug, roles, accounts: config.accounts, myRole });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Chat ---

  app.post("/api/projects/:slug/chat", (req, res) => {
    const project = ctx.getProject(req.params.slug);
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/projects/:slug/chat/history", (req, res) => {
    const project = ctx.getProject(req.params.slug);
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
    } catch { res.json({ messages: [] }); }
  });

  // --- SSE feed ---

  app.get("/api/feed", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const gather = () => {
      try {
        const projects = ctx.getProjects();
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
              } catch {}
              allEntries.push({ project: p.name, slug: p.slug, role: name, type: rc.type, running, status });
            }
          } catch {}
        }
        res.write(`data: ${JSON.stringify({ type: "status", entries: allEntries, ts: new Date().toISOString() })}\n\n`);
      } catch {}
    };
    gather();
    const timer = setInterval(gather, 5000);
    _req.on("close", () => clearInterval(timer));
  });

  // --- Accounts ---

  app.get("/api/accounts", (_req, res) => {
    try {
      const homeDir = os.homedir();
      const detected = fs.readdirSync(homeDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith(".claude"))
        .map(e => ({
          name: e.name.replace(/^\.claude/, "") || "default",
          path: `~/${e.name}`,
          fullPath: path.join(homeDir, e.name),
          needsLogin: ctx.checkNeedsLogin(path.join(homeDir, e.name)),
        }));
      res.json({ accounts: detected });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- System metrics ---

  app.get("/api/metrics", (_req, res) => {
    try {
      const cpus = os.cpus();
      const load1 = os.loadavg()[0];
      const cpuPercent = Math.min(100, Math.round((load1 / cpus.length) * 100));
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
      let diskPercent = 0, diskUsed = "", diskTotal = "";
      try {
        const df = execFileSync("df", ["-h", "/"], { encoding: "utf-8" });
        const parts = df.trim().split("\n")[1].split(/\s+/);
        diskTotal = parts[1]; diskUsed = parts[2]; diskPercent = parseInt(parts[4], 10) || 0;
      } catch {}
      res.json({
        cpu: { percent: cpuPercent, cores: cpus.length, load1: load1.toFixed(2) },
        memory: { percent: memPercent, used: formatBytes(totalMem - freeMem), total: formatBytes(totalMem) },
        disk: { percent: diskPercent, used: diskUsed, total: diskTotal },
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Path autocomplete ---

  app.get("/api/complete-path", (req, res) => {
    const partial = String(req.query.q || "");
    if (!partial) { res.json({ suggestions: [] }); return; }
    try {
      const expanded = partial.startsWith("~") ? path.join(os.homedir(), partial.slice(1)) : partial;
      const dir = expanded.endsWith("/") ? expanded : path.dirname(expanded);
      const prefix = expanded.endsWith("/") ? "" : path.basename(expanded);
      if (!fs.existsSync(dir)) { res.json({ suggestions: [] }); return; }
      const entries = fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith(".") && e.name.toLowerCase().startsWith(prefix.toLowerCase()))
        .slice(0, 15)
        .map(e => {
          const full = path.join(dir, e.name);
          const display = partial.startsWith("~") ? "~" + full.slice(os.homedir().length) : full;
          return { path: display + "/", hasEvomesh: fs.existsSync(path.join(full, ".evomesh", "project.yaml")) };
        });
      res.json({ suggestions: entries });
    } catch { res.json({ suggestions: [] }); }
  });

  // --- Project members ---

  app.get("/api/projects/:slug/members", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "viewer")) return;
    const members = listMembers(project.root);
    res.json(members || { owner: "", members: [] });
  });

  app.post("/api/projects/:slug/members", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const { username, role } = req.body;
    if (!username || !USERNAME_RE.test(username)) { res.status(400).json({ error: "Invalid username" }); return; }
    if (role !== "member" && role !== "viewer") { res.status(400).json({ error: "Role must be 'member' or 'viewer'" }); return; }
    try {
      grantAccess(project.root, username, role);
      res.json({ ok: true, username, role });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/projects/:slug/members/:username", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    try {
      revokeAccess(project.root, req.params.username);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // --- Mission Control ---

  app.get("/api/mission-control", (req, res) => {
    if (!requireProjectRole(req, res, ctx.getProjects()[0]?.root || "/", "viewer")) return;
    try {
      const projects = ctx.getProjects();
      const activity: Array<{ project: string; role: string; text: string; ts?: string }> = [];
      const alerts: Array<{ level: "error" | "warning"; message: string; project?: string; role?: string }> = [];
      const tasks: Array<{ priority: string; text: string; project: string; role: string; done: boolean }> = [];

      for (const p of projects) {
        let config;
        try { config = loadConfig(p.root); } catch { continue; }

        for (const [name, rc] of Object.entries(config.roles)) {
          const rDir = roleDir(p.root, name);
          const running = isRoleRunning(p.root, name);

          // Activity: read short-term memory
          try {
            const stm = fs.readFileSync(path.join(rDir, "memory", "short-term.md"), "utf-8");
            const bullets = stm.match(/^- .+$/gm);
            if (bullets) {
              for (const b of bullets.slice(-3)) {
                activity.push({ project: p.name, role: name, text: b.replace(/^- /, "") });
              }
            }
          } catch {}

          // Alerts: role not running
          if (!running) {
            alerts.push({ level: "error", message: `Role "${name}" is not running`, project: p.name, role: name });
          }

          // Tasks: parse todo.md
          try {
            const todo = fs.readFileSync(path.join(rDir, "todo.md"), "utf-8");
            let currentPriority = "P?";
            for (const line of todo.split("\n")) {
              const headerMatch = line.match(/^## (P\d)/);
              if (headerMatch) { currentPriority = headerMatch[1]; continue; }
              const taskMatch = line.match(/^[-*]\s+(.+)/);
              if (!taskMatch) continue;
              const text = taskMatch[1];
              const done = text.startsWith("~~") || text.includes("✅");
              // Alert: unprocessed P0
              if (currentPriority === "P0" && !done) {
                alerts.push({ level: "warning", message: `P0 pending: ${text.slice(0, 60)}`, project: p.name, role: name });
              }
              tasks.push({ priority: currentPriority, text: text.slice(0, 120), project: p.name, role: name, done });
            }
          } catch {}
        }
      }

      // Sort tasks: P0 first, undone first
      tasks.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.priority.localeCompare(b.priority);
      });

      res.json({ activity, alerts, tasks, ts: new Date().toISOString() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Backward compat ---

  app.get("/api/status", (_req, res) => {
    const projects = ctx.getProjects();
    if (projects.length === 0) { res.json({ project: "none", roles: [] }); return; }
    res.redirect(`/api/projects/${projects[0].slug}/status`);
  });

  // --- Register extracted route groups ---
  registerRoleRoutes(app, ctx);
  registerAdminRoutes(app, ctx);
}
