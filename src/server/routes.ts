import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import YAML from "yaml";
import { loadConfig } from "../config/loader.js";
import { roleDir, evomeshDir, expandHome } from "../utils/paths.js";
import { loadWorkspace, saveWorkspace, addProject, slugify } from "../workspace/config.js";
import { smartInit } from "../workspace/smartInit.js";
import { createRole, deleteRole } from "../roles/manager.js";
import { TEMPLATES, TEMPLATE_NAMES } from "../roles/templates/index.js";
import { exists } from "../utils/fs.js";
import {
  startRole, stopRole, restartRole, isRoleRunning,
  getRoleLogs, sendInput, switchAccount as switchContainerAccount,
} from "../process/container.js";
import { ensureTtydRunning } from "./terminal.js";
import type { ServerContext } from "./index.js";

const ROLE_NAME_RE = /^[a-zA-Z0-9_-]+$/;

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(0) + " KB";
  if (bytes < 1024 ** 3) return (bytes / (1024 ** 2)).toFixed(1) + " MB";
  return (bytes / (1024 ** 3)).toFixed(1) + " GB";
}

export function registerRoutes(app: import("express").Express, ctx: ServerContext): void {

  // --- Projects ---

  app.get("/api/projects", (_req, res) => {
    try {
      const projects = ctx.getProjects();
      const result = projects.map(p => {
        let hasConfig = false, roleCount = 0;
        try { const c = loadConfig(p.root); hasConfig = true; roleCount = Object.keys(c.roles).length; } catch {}
        return { slug: p.slug, name: p.name, path: p.root, hasConfig, roleCount };
      });
      res.json({ projects: result });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/projects/add", async (req, res) => {
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
        const ttydPort = ctx.port + 1;
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
    // Stop all containers for this project
    try {
      const config = loadConfig(project.root);
      for (const roleName of Object.keys(config.roles)) {
        stopRole(project.root, roleName);
        ctx.ttydProcesses.delete(`${project.slug}/${roleName}`);
      }
    } catch {}
    const ws = loadWorkspace();
    ws.projects = ws.projects.filter(p => path.resolve(p.path) !== project.root);
    saveWorkspace(ws);
    res.json({ ok: true });
  });

  // --- Project status ---

  app.get("/api/projects/:slug/status", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
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
      res.json({ project: project.name, slug: project.slug, roles, accounts: config.accounts });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Role lifecycle ---

  app.post("/api/projects/:slug/roles/:name/start", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).send("Invalid"); return; }
    const roleName = req.params.name;
    try {
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }

      // Allocate port
      let ttydPort = ctx.port + 1;
      for (const [, t] of ctx.ttydProcesses) { if (t.port >= ttydPort) ttydPort = t.port + 1; }

      const result = startRole(project.root, roleName, rc, config, ttydPort);
      ctx.ttydProcesses.set(`${project.slug}/${roleName}`, { port: ttydPort, roleName, projectSlug: project.slug });
      res.json({ ok: true, ...result });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/projects/:slug/roles/:name/stop", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).send("Invalid"); return; }
    stopRole(project.root, req.params.name);
    ctx.ttydProcesses.delete(`${project.slug}/${req.params.name}`);
    res.json({ ok: true });
  });

  app.post("/api/projects/:slug/roles/:name/restart", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).send("Invalid"); return; }
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
        let ttydPort = ctx.port + 1;
        for (const [, t] of ctx.ttydProcesses) { if (t.port >= ttydPort) ttydPort = t.port + 1; }
        startRole(project.root, roleName, rc, config, ttydPort);
        ctx.ttydProcesses.set(`${project.slug}/${roleName}`, { port: ttydPort, roleName, projectSlug: project.slug });
      }
      res.json({ ok: true, role: roleName });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Role logs ---

  app.get("/api/projects/:slug/roles/:name/log", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).send("Invalid"); return; }
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
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).send("Invalid"); return; }
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

  // --- Account switching ---

  app.post("/api/projects/:slug/roles/:name/account", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).send("Invalid"); return; }
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

  // --- Chat ---

  app.post("/api/projects/:slug/chat", (req, res) => {
    const project = ctx.getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
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

  // --- Backward compat ---

  app.get("/api/status", (_req, res) => {
    const projects = ctx.getProjects();
    if (projects.length === 0) { res.json({ project: "none", roles: [] }); return; }
    res.redirect(`/api/projects/${projects[0].slug}/status`);
  });
}
