import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import express from "express";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { loadConfig } from "../config/loader.js";
import { readPid } from "../process/registry.js";
import { spawnRole, stopRole } from "../process/spawner.js";
import { runtimeDir, roleDir, evomeshDir, expandHome } from "../utils/paths.js";
import { loadWorkspace, saveWorkspace, addProject, slugify, ensureInWorkspace } from "../workspace/config.js";
import { smartInit } from "../workspace/smartInit.js";
import { createRole, deleteRole } from "../roles/manager.js";
import { TEMPLATES, TEMPLATE_NAMES } from "../roles/templates/index.js";
import { exists } from "../utils/fs.js";
import { isPasswordSet, setPassword, verifyPassword, generateSessionToken } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROLE_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const SLUG_RE = /^[a-z0-9_-]+$/;

interface TtydProcess {
  port: number;
  process: ReturnType<typeof spawn>;
  roleName: string;
  projectSlug: string;
}

interface ProjectEntry {
  slug: string;
  name: string;
  root: string;
}

export function startServer(port: number, initialRoot?: string) {
  const app = express();
  const server = http.createServer(app);
  app.use(express.json());

  // Active session tokens
  const sessions = new Set<string>();

  // --- Auth routes (no auth required) ---
  app.get("/auth/status", (_req, res) => {
    res.json({ passwordSet: isPasswordSet() });
  });

  app.post("/auth/setup", (req, res) => {
    if (isPasswordSet()) { res.status(400).json({ error: "Password already set" }); return; }
    const { password } = req.body;
    if (!password || password.length < 4) { res.status(400).json({ error: "Password too short (min 4)" }); return; }
    setPassword(password);
    const token = generateSessionToken();
    sessions.add(token);
    res.json({ ok: true, token });
  });

  app.post("/auth/login", (req, res) => {
    const { password } = req.body;
    if (!verifyPassword(password)) { res.status(401).json({ error: "Wrong password" }); return; }
    const token = generateSessionToken();
    sessions.add(token);
    res.json({ ok: true, token });
  });

  app.post("/auth/change-password", (req, res) => {
    const token = extractSession(req);
    if (!token || !sessions.has(token)) { res.status(401).json({ error: "Not authenticated" }); return; }
    const { oldPassword, newPassword } = req.body;
    if (!verifyPassword(oldPassword)) { res.status(401).json({ error: "Wrong current password" }); return; }
    if (!newPassword || newPassword.length < 4) { res.status(400).json({ error: "New password too short" }); return; }
    setPassword(newPassword);
    res.json({ ok: true });
  });

  // --- Session auth middleware ---
  function extractSession(req: { headers: { authorization?: string }; query?: any; url?: string }): string | undefined {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    if (typeof req.query?.token === "string") return req.query.token;
    const url = new URL(req.url || "/", "http://localhost");
    return url.searchParams.get("token") || undefined;
  }

  app.use((req, res, next) => {
    // Auth routes are public
    if (req.path.startsWith("/auth/")) return next();
    // Login page served without auth
    if (req.path === "/login") return next();
    // Main page without session → redirect to login
    if (req.path === "/" && !sessions.has(extractSession(req) || "")) {
      return res.redirect("/login");
    }
    // API/other routes require valid session
    const token = extractSession(req);
    if (!token || !sessions.has(token)) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    next();
  });

  const ttydProcesses: Map<string, TtydProcess> = new Map(); // key: "slug/role"

  // --- Load projects from workspace ---

  function getProjects(): ProjectEntry[] {
    // Ensure initial root is in workspace
    if (initialRoot) ensureInWorkspace(initialRoot);

    const ws = loadWorkspace();
    return ws.projects
      .filter(p => p.active)
      .map(p => ({ slug: slugify(p.name), name: p.name, root: path.resolve(p.path) }));
  }

  function getProject(slug: string): ProjectEntry | undefined {
    return getProjects().find(p => p.slug === slug);
  }

  // --- ttyd management ---

  // tmux session naming: matches spawner.ts convention (evomesh-{roleName})
  // For multi-project, the slug is ignored for now — role names must be unique
  // across projects or sessions will collide. Future: make spawner project-aware.
  function tmuxSession(_slug: string, roleName: string): string {
    return `evomesh-${roleName}`;
  }

  function startTtyd(project: ProjectEntry, roleName: string, ttydPort: number): TtydProcess | null {
    const session = tmuxSession(project.slug, roleName);
    try {
      execFileSync("tmux", ["has-session", "-t", session], { stdio: "ignore" });
    } catch { return null; }

    try { execFileSync("fuser", ["-k", `${ttydPort}/tcp`], { stdio: "ignore" }); } catch {}

    const basePath = `/terminal/${project.slug}/${roleName}`;
    const proc = spawn("ttyd", [
      "--port", String(ttydPort),
      "--interface", "127.0.0.1",
      "--writable",
      "--base-path", basePath,
      "tmux", "attach-session", "-t", session,
    ], { detached: true, stdio: "ignore", cwd: project.root });
    proc.unref();

    return { port: ttydPort, process: proc, roleName, projectSlug: project.slug };
  }

  function ensureTtydRunning() {
    try {
      const projects = getProjects();
      let portOffset = 0;
      for (const project of projects) {
        try {
          const config = loadConfig(project.root);
          for (const roleName of Object.keys(config.roles)) {
            const key = `${project.slug}/${roleName}`;
            if (ttydProcesses.has(key)) { portOffset++; continue; }
            const info = readPid(project.root, roleName);
            if (!info?.alive) { portOffset++; continue; }

            const ttydPort = port + 1 + portOffset;
            const proc = startTtyd(project, roleName, ttydPort);
            if (proc) ttydProcesses.set(key, proc);
            portOffset++;
          }
        } catch {}
      }
    } catch {}
  }

  // --- Reverse proxy ---

  function proxyRequest(req: http.IncomingMessage, res: http.ServerResponse, targetPort: number) {
    const proxyReq = http.request({
      hostname: "127.0.0.1", port: targetPort, path: req.url, method: req.method, headers: req.headers,
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", () => { res.writeHead(502); res.end("ttyd not ready"); });
    req.pipe(proxyReq);
  }

  // HTTP proxy: /terminal/{slug}/{role}/*
  app.use((req, res, next) => {
    const match = req.url.match(/^\/terminal\/([a-z0-9_-]+)\/([a-zA-Z0-9_-]+)(\/.*)?$/);
    if (!match) return next();
    const key = `${match[1]}/${match[2]}`;
    const ttyd = ttydProcesses.get(key);
    if (!ttyd) { res.status(404).send("Terminal not available"); return; }
    proxyRequest(req, res as unknown as http.ServerResponse, ttyd.port);
  });

  // WebSocket proxy (with session auth)
  server.on("upgrade", (req, socket, head) => {
    const wsToken = extractSession(req as any);
    if (!wsToken || !sessions.has(wsToken)) { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); socket.destroy(); return; }

    const url = req.url || "";
    const match = url.match(/^\/terminal\/([a-z0-9_-]+)\/([a-zA-Z0-9_-]+)\//);
    if (!match) return;
    const key = `${match[1]}/${match[2]}`;
    const ttyd = ttydProcesses.get(key);
    if (!ttyd) { socket.destroy(); return; }

    const proxyReq = http.request({
      hostname: "127.0.0.1", port: ttyd.port, path: req.url, method: "GET", headers: req.headers,
    });
    proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
      let responseHead = `HTTP/1.1 101 Switching Protocols\r\n`;
      for (const [k, v] of Object.entries(proxyRes.headers)) {
        if (v) responseHead += `${k}: ${Array.isArray(v) ? v.join(", ") : v}\r\n`;
      }
      responseHead += "\r\n";
      socket.write(responseHead);
      if (proxyHead.length) socket.write(proxyHead);
      if (head.length) proxySocket.write(head);
      socket.pipe(proxySocket);
      proxySocket.pipe(socket);
      socket.on("error", () => proxySocket.destroy());
      proxySocket.on("error", () => socket.destroy());
      socket.on("close", () => proxySocket.destroy());
      proxySocket.on("close", () => socket.destroy());
    });
    proxyReq.on("error", () => socket.destroy());
    proxyReq.end();
  });

  // --- Helper: check login status ---

  function checkNeedsLogin(accountDir: string): boolean {
    try {
      const dotCreds = path.join(accountDir, ".credentials.json");
      const plainCreds = path.join(accountDir, "credentials.json");
      const credsPath = fs.existsSync(dotCreds) ? dotCreds : plainCreds;
      if (!fs.existsSync(credsPath)) return true;
      const creds = fs.readFileSync(credsPath, "utf-8").trim();
      return !creds || creds === "{}" || creds === "null";
    } catch { return true; }
  }

  // =====================
  // REST API
  // =====================

  // --- Projects list ---
  app.get("/api/projects", (_req, res) => {
    try {
      const projects = getProjects();
      const result = projects.map(p => {
        let hasConfig = false;
        let roleCount = 0;
        try {
          const config = loadConfig(p.root);
          hasConfig = true;
          roleCount = Object.keys(config.roles).length;
        } catch {}
        return { slug: p.slug, name: p.name, path: p.root, hasConfig, roleCount };
      });
      res.json({ projects: result });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Add project ---
  app.post("/api/projects/add", async (req, res) => {
    try {
      const { url, path: localPath, lang: reqLang } = req.body;
      const lang = (reqLang === "en" ? "en" : "zh") as "zh" | "en";
      let projectRoot: string;
      let projectName: string;

      if (url && typeof url === "string") {
        // Clone from GitHub
        const repoName = url.replace(/\.git$/, "").split("/").pop() || "project";
        projectRoot = path.join(os.homedir(), "work", repoName);
        projectName = repoName;
        if (!exists(projectRoot)) {
          execFileSync("git", ["clone", url, projectRoot], { timeout: 60000 });
        }
      } else if (localPath && typeof localPath === "string") {
        projectRoot = path.resolve(expandHome(localPath));
        projectName = path.basename(projectRoot);
        if (!fs.existsSync(projectRoot)) {
          res.status(400).json({ error: "Path does not exist" });
          return;
        }
      } else {
        res.status(400).json({ error: "Provide url or path" });
        return;
      }

      // Smart init (creates .evomesh/ if needed, default roles)
      const config = smartInit(projectRoot, projectName, lang);

      // Add to workspace
      const project = addProject(projectName, projectRoot, lang);
      const slug = slugify(projectName);

      // Write initialization task for lead
      const leadName = Object.entries(config.roles).find(([, rc]) => rc.type === "lead")?.[0];
      if (leadName) {
        const isEn = lang === "en";
        const todoPath = path.join(roleDir(projectRoot, leadName), "todo.md");
        const initTask = isEn
          ? `# ${leadName} — Tasks\n\n## P0 — Project Initialization\n\n1. **Analyze project structure**: Read the codebase (README, package.json, src/, etc.) to understand what this project does\n2. **Review existing roles**: If the project has custom role definitions or CLAUDE.md, preserve their domain-specific prompts while ensuring EvoMesh structure compliance\n3. **Design role strategy**: Decide if additional roles are needed beyond lead+executor (e.g. reviewer, designer)\n4. **Update blueprint.md**: Write project vision, technical roadmap, architecture overview\n5. **Update status.md**: Document current project state\n6. **Dispatch initial tasks**: Write concrete tasks to executor's todo.md\n`
          : `# ${leadName} — 待办任务\n\n## P0 — 项目初始化\n\n1. **分析项目结构**: 阅读代码库（README、package.json、src/ 等），理解项目做什么\n2. **审查现有角色**: 如果项目有自定义角色定义或 CLAUDE.md，保留其领域特定提示词，同时确保 EvoMesh 结构合规\n3. **设计角色策略**: 判断是否需要 lead+executor 之外的额外角色（如 reviewer、designer）\n4. **更新 blueprint.md**: 撰写项目愿景、技术路线、架构概览\n5. **更新 status.md**: 记录当前项目状态\n6. **分派初始任务**: 向 executor 的 todo.md 写入具体任务\n`;
        fs.writeFileSync(todoPath, initTask, "utf-8");

        // Start lead
        const rc = config.roles[leadName];
        try { spawnRole(projectRoot, leadName, rc, config); } catch {}
        setTimeout(ensureTtydRunning, 3000);
      }

      res.json({ ok: true, project: { slug, name: projectName, path: projectRoot } });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Remove project ---
  app.delete("/api/projects/:slug", (req, res) => {
    const project = getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    const ws = loadWorkspace();
    ws.projects = ws.projects.filter(p => path.resolve(p.path) !== project.root);
    saveWorkspace(ws);
    res.json({ ok: true });
  });

  // --- Project status ---
  app.get("/api/projects/:slug/status", (req, res) => {
    const project = getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    try {
      const config = loadConfig(project.root);
      const roles = Object.entries(config.roles).map(([name, rc]) => {
        const info = readPid(project.root, name);
        const key = `${project.slug}/${name}`;
        const ttyd = ttydProcesses.get(key);
        const accountDir = expandHome(config.accounts[rc.account] || "~/.claude");
        return {
          name, type: rc.type, loop_interval: rc.loop_interval, description: rc.description,
          running: info?.alive ?? false, pid: info?.pid ?? null,
          terminal: ttyd ? `/terminal/${project.slug}/${name}/` : null,
          account: rc.account, needsLogin: checkNeedsLogin(accountDir),
        };
      });
      res.json({ project: project.name, slug: project.slug, roles, accounts: config.accounts });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Role log ---
  app.get("/api/projects/:slug/roles/:name/log", (req, res) => {
    const project = getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).send("Invalid"); return; }
    const logPath = path.join(runtimeDir(project.root), `${req.params.name}.log`);
    if (!fs.existsSync(logPath)) { res.status(404).json({ error: "Log not found" }); return; }
    const stat = fs.statSync(logPath);
    const start = Math.max(0, stat.size - 50000);
    fs.createReadStream(logPath, { start }).pipe(res);
  });

  // --- SSE feed (all projects) ---
  app.get("/api/feed", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const gather = () => {
      try {
        const projects = getProjects();
        const allEntries: Array<{ project: string; slug: string; role: string; type: string; running: boolean; status: string }> = [];

        for (const p of projects) {
          try {
            const config = loadConfig(p.root);
            for (const [name, rc] of Object.entries(config.roles)) {
              const info = readPid(p.root, name);
              const running = info?.alive ?? false;
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

  // --- Chat ---
  app.post("/api/projects/:slug/chat", (req, res) => {
    const project = getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    const { message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) { res.status(400).json({ error: "Empty" }); return; }

    try {
      const config = loadConfig(project.root);
      const leadName = Object.entries(config.roles).find(([, rc]) => rc.type === "lead")?.[0];
      if (!leadName) { res.status(404).json({ error: "No lead role" }); return; }

      const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
      const inboxPath = path.join(roleDir(project.root, leadName), "inbox", `${ts}_user_chat.md`);
      fs.mkdirSync(path.dirname(inboxPath), { recursive: true });
      fs.writeFileSync(inboxPath, `---\nfrom: user\npriority: high\ntype: chat\n---\n\n${message.trim()}\n`, "utf-8");

      const session = tmuxSession(project.slug, leadName);
      try {
        execFileSync("tmux", ["has-session", "-t", session], { stdio: "ignore" });
        execFileSync("tmux", ["send-keys", "-t", session, "-l", `[用户消息] ${message.trim()}`], { stdio: "ignore" });
        execFileSync("tmux", ["send-keys", "-t", session, "Enter"], { stdio: "ignore" });
      } catch {}

      res.json({ ok: true, delivered_to: leadName });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Chat history ---
  app.get("/api/projects/:slug/chat/history", (req, res) => {
    const project = getProject(req.params.slug);
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
          needsLogin: checkNeedsLogin(path.join(homeDir, e.name)),
        }));
      res.json({ accounts: detected });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Account switch ---
  app.post("/api/projects/:slug/roles/:name/account", (req, res) => {
    const project = getProject(req.params.slug);
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

      const wasRunning = readPid(project.root, roleName)?.alive ?? false;
      if (wasRunning) {
        stopRole(project.root, roleName);
        const key = `${project.slug}/${roleName}`;
        const ttyd = ttydProcesses.get(key);
        if (ttyd) { try { ttyd.process.kill(); } catch {} ttydProcesses.delete(key); }
        setTimeout(() => {
          try {
            const fresh = loadConfig(project.root);
            const freshRc = fresh.roles[roleName];
            if (freshRc) { spawnRole(project.root, roleName, freshRc, fresh); setTimeout(ensureTtydRunning, 3000); }
          } catch {}
        }, 2000);
      }

      res.json({ ok: true, oldAccount, newAccount: accountName, restarted: wasRunning });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Role restart ---
  app.post("/api/projects/:slug/roles/:name/restart", (req, res) => {
    const project = getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).send("Invalid"); return; }
    const roleName = req.params.name;

    try {
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }

      // Stop if running
      stopRole(project.root, roleName);
      const key = `${project.slug}/${roleName}`;
      const ttyd = ttydProcesses.get(key);
      if (ttyd) { try { ttyd.process.kill(); } catch {} ttydProcesses.delete(key); }

      // Restart after cleanup
      setTimeout(() => {
        try {
          const fresh = loadConfig(project.root);
          const freshRc = fresh.roles[roleName];
          if (freshRc) {
            spawnRole(project.root, roleName, freshRc, fresh);
            setTimeout(ensureTtydRunning, 3000);
          }
        } catch (e: any) {
          console.error(`Failed to restart ${roleName}:`, e.message);
        }
      }, 2000);

      res.json({ ok: true, role: roleName });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Role management ---

  // List available templates
  app.get("/api/templates", (_req, res) => {
    res.json({ templates: TEMPLATE_NAMES });
  });

  // Create role
  app.post("/api/projects/:slug/roles", (req, res) => {
    const project = getProject(req.params.slug);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const { name, template, account } = req.body;
    if (!name || !ROLE_NAME_RE.test(name)) { res.status(400).json({ error: "Invalid role name" }); return; }
    if (!template || !TEMPLATES[template]) {
      res.status(400).json({ error: `Invalid template. Available: ${TEMPLATE_NAMES.join(", ")}` });
      return;
    }

    try {
      const config = loadConfig(project.root);
      if (config.roles[name]) { res.status(409).json({ error: `Role "${name}" already exists` }); return; }

      createRole(project.root, name, template, config, account || "main");
      res.json({ ok: true, role: name, template });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Delete role
  app.delete("/api/projects/:slug/roles/:name", (req, res) => {
    const project = getProject(req.params.slug);
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).send("Invalid"); return; }
    const roleName = req.params.name;

    try {
      const config = loadConfig(project.root);
      if (!config.roles[roleName]) { res.status(404).json({ error: "Role not found" }); return; }

      // Stop if running
      const info = readPid(project.root, roleName);
      if (info?.alive) stopRole(project.root, roleName);

      // Kill ttyd
      const key = `${project.slug}/${roleName}`;
      const ttyd = ttydProcesses.get(key);
      if (ttyd) { try { ttyd.process.kill(); } catch {} ttydProcesses.delete(key); }

      // Delete role
      deleteRole(project.root, roleName, config);
      res.json({ ok: true });
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
          const display = partial.startsWith("~")
            ? "~" + full.slice(os.homedir().length)
            : full;
          const hasEvomesh = fs.existsSync(path.join(full, ".evomesh", "project.yaml"));
          return { path: display + "/", hasEvomesh };
        });
      res.json({ suggestions: entries });
    } catch { res.json({ suggestions: [] }); }
  });

  // --- System metrics ---
  app.get("/api/metrics", (_req, res) => {
    try {
      const cpus = os.cpus();
      const cpuTotal = cpus.reduce((a, c) => {
        const t = Object.values(c.times).reduce((s, v) => s + v, 0);
        return { idle: a.idle + c.times.idle, total: a.total + t };
      }, { idle: 0, total: 0 });
      // Read /proc/stat for accurate usage since boot is misleading; use loadavg instead
      const load1 = os.loadavg()[0];
      const cpuPercent = Math.min(100, Math.round((load1 / cpus.length) * 100));

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

      // Disk usage via df
      let diskPercent = 0;
      let diskUsed = "";
      let diskTotal = "";
      try {
        const df = execFileSync("df", ["-h", "/"], { encoding: "utf-8" });
        const line = df.trim().split("\n")[1];
        const parts = line.split(/\s+/);
        diskTotal = parts[1];
        diskUsed = parts[2];
        diskPercent = parseInt(parts[4], 10) || 0;
      } catch {}

      res.json({
        cpu: { percent: cpuPercent, cores: cpus.length, load1: load1.toFixed(2) },
        memory: {
          percent: memPercent,
          used: formatBytes(totalMem - freeMem),
          total: formatBytes(totalMem),
        },
        disk: { percent: diskPercent, used: diskUsed, total: diskTotal },
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  function formatBytes(bytes: number): string {
    if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(0) + " KB";
    if (bytes < 1024 ** 3) return (bytes / (1024 ** 2)).toFixed(1) + " MB";
    return (bytes / (1024 ** 3)).toFixed(1) + " GB";
  }

  // --- Backward compat: /api/status redirects to first project ---
  app.get("/api/status", (_req, res) => {
    const projects = getProjects();
    if (projects.length === 0) { res.json({ project: "none", roles: [] }); return; }
    res.redirect(`/api/projects/${projects[0].slug}/status`);
  });

  // Login page
  app.get("/login", (_req, res) => {
    res.type("html").send(loginPageHtml());
  });

  // Serve static frontend
  app.get("/", (req, res) => {
    const htmlPath = path.join(__dirname, "..", "..", "src", "server", "frontend.html");
    const distPath = path.join(__dirname, "frontend.html");
    const filePath = fs.existsSync(htmlPath) ? htmlPath : distPath;
    if (!fs.existsSync(filePath)) { res.send("Frontend not found."); return; }
    // Inject session token for API calls
    const token = extractSession(req) || "";
    let html = fs.readFileSync(filePath, "utf-8");
    html = html.replace("</head>", `<meta name="evomesh-token" content="${token}">\n</head>`);
    res.type("html").send(html);
  });

  // Start ttyd instances
  ensureTtydRunning();
  setInterval(ensureTtydRunning, 10000);

  // Cleanup
  const cleanup = () => {
    for (const [, t] of ttydProcesses) { try { t.process.kill(); } catch {} }
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // IMPORTANT: 必须 0.0.0.0 — 远程服务器需外网访问，勿改为 127.0.0.1（见 shared/decisions.md）
  server.listen(port, "0.0.0.0", () => {
    console.log(`\n  EvoMesh Web UI running at:`);
    console.log(`    http://localhost:${port}`);
    console.log(`\n  ${isPasswordSet() ? "Password is set. Login at /login" : "No password set. First visitor will set up password."}\n`);
  });
}

function loginPageHtml(): string {
  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EvoMesh — Login</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, monospace; height: 100vh; display: flex; align-items: center; justify-content: center; }
  .login-box { background: #111; border: 1px solid #222; border-radius: 12px; padding: 32px; width: 90vw; max-width: 360px; }
  h1 { color: #e94560; font-size: 24px; margin-bottom: 8px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
  label { display: block; color: #888; font-size: 11px; margin-bottom: 6px; }
  input { width: 100%; padding: 12px; background: #0a0a0a; border: 1px solid #222; color: #e0e0e0; border-radius: 6px; font-size: 14px; margin-bottom: 16px; }
  input:focus { outline: none; border-color: #e94560; }
  button { width: 100%; padding: 12px; background: #e94560; border: none; color: #fff; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
  button:hover { background: #d63851; }
  button:disabled { background: #444; cursor: not-allowed; }
  .error { color: #ef4444; font-size: 12px; margin-bottom: 12px; display: none; }
  .error.show { display: block; }
</style></head><body>
<div class="login-box">
  <h1>EvoMesh</h1>
  <div class="sub" id="subtitle">Loading...</div>
  <div class="error" id="error"></div>
  <div id="setup-form" style="display:none">
    <label>Set Password</label>
    <input type="password" id="new-pw" placeholder="Choose a password (min 4 chars)" />
    <label>Confirm Password</label>
    <input type="password" id="confirm-pw" placeholder="Confirm password" />
    <button onclick="doSetup()">Set Password & Enter</button>
  </div>
  <div id="login-form" style="display:none">
    <label>Password</label>
    <input type="password" id="pw" placeholder="Enter password" />
    <button onclick="doLogin()">Login</button>
  </div>
</div>
<script>
async function init() {
  const r = await fetch('/auth/status');
  const d = await r.json();
  if (d.passwordSet) {
    document.getElementById('subtitle').textContent = 'Enter your password';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('pw').focus();
  } else {
    document.getElementById('subtitle').textContent = 'First time setup — create a password';
    document.getElementById('setup-form').style.display = 'block';
    document.getElementById('new-pw').focus();
  }
}
function showError(msg) { const e = document.getElementById('error'); e.textContent = msg; e.classList.add('show'); }
async function doSetup() {
  const pw = document.getElementById('new-pw').value;
  const confirm = document.getElementById('confirm-pw').value;
  if (pw.length < 4) { showError('Password must be at least 4 characters'); return; }
  if (pw !== confirm) { showError('Passwords do not match'); return; }
  const r = await fetch('/auth/setup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password:pw}) });
  const d = await r.json();
  if (d.ok) { localStorage.setItem('evomesh-token', d.token); location.href = '/?token=' + encodeURIComponent(d.token); }
  else showError(d.error);
}
async function doLogin() {
  const pw = document.getElementById('pw').value;
  const r = await fetch('/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password:pw}) });
  const d = await r.json();
  if (d.ok) { localStorage.setItem('evomesh-token', d.token); location.href = '/?token=' + encodeURIComponent(d.token); }
  else showError(d.error || 'Wrong password');
}
document.addEventListener('keydown', e => { if (e.key === 'Enter') { document.getElementById('login-form').style.display !== 'none' ? doLogin() : doSetup(); } });
// Auto-login: verify saved token before redirecting
(async () => {
  const saved = localStorage.getItem('evomesh-token');
  if (saved) {
    try {
      const r = await fetch('/api/projects', { headers: { 'Authorization': 'Bearer ' + saved } });
      if (r.ok) { location.href = '/?token=' + encodeURIComponent(saved); return; }
    } catch {}
    // Token invalid — clear and show login
    localStorage.removeItem('evomesh-token');
  }
  init();
})();
</script></body></html>`;
}

