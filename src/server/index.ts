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
import { migrateIfNeeded, hasAnyUser, setupAdmin, verifyUser, changePassword, listUsers, addUser, deleteUser, resetPassword, generateSessionToken } from "./auth.js";
import type { SessionInfo, UserRole } from "./auth.js";

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

  // Migrate legacy single-user auth if needed
  migrateIfNeeded();

  // Active sessions: token → {username, role}
  const sessions = new Map<string, SessionInfo>();

  // --- Auth routes (no auth required) ---
  app.get("/auth/status", (_req, res) => {
    res.json({ hasUsers: hasAnyUser() });
  });

  app.post("/auth/setup", (req, res) => {
    if (hasAnyUser()) { res.status(400).json({ error: "Admin already exists" }); return; }
    const { username, password } = req.body;
    const name = (username || "admin").trim();
    if (!name || name.length < 2) { res.status(400).json({ error: "Username too short (min 2)" }); return; }
    if (!password || password.length < 4) { res.status(400).json({ error: "Password too short (min 4)" }); return; }
    try {
      setupAdmin(name, password);
      const token = generateSessionToken();
      sessions.set(token, { username: name, role: "admin" });
      res.json({ ok: true, token, username: name, role: "admin" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }
    const user = verifyUser(username, password);
    if (!user) { res.status(401).json({ error: "Invalid username or password" }); return; }
    const token = generateSessionToken();
    sessions.set(token, { username: user.username, role: user.role });
    res.json({ ok: true, token, username: user.username, role: user.role });
  });

  app.post("/auth/change-password", (req, res) => {
    const session = getSession(req);
    if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) { res.status(400).json({ error: "New password too short" }); return; }
    if (!changePassword(session.username, oldPassword, newPassword)) {
      res.status(401).json({ error: "Wrong current password" }); return;
    }
    res.json({ ok: true });
  });

  // --- Session helpers ---
  function extractToken(req: { headers: { authorization?: string }; query?: any; url?: string }): string | undefined {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    if (typeof req.query?.token === "string") return req.query.token;
    const url = new URL(req.url || "/", "http://localhost");
    return url.searchParams.get("token") || undefined;
  }

  function getSession(req: { headers: { authorization?: string }; query?: any; url?: string }): SessionInfo | undefined {
    const token = extractToken(req);
    if (!token) return undefined;
    return sessions.get(token);
  }

  app.get("/auth/validate", (req, res) => {
    const session = getSession(req);
    res.json({ valid: !!session, username: session?.username, role: session?.role });
  });

  // --- Auth + role middleware ---
  app.use((req, res, next) => {
    if (req.path.startsWith("/auth/")) return next();
    if (req.path === "/login" || req.path === "/") return next();
    const session = getSession(req);
    if (!session) { return res.status(401).json({ error: "Not authenticated" }); }
    // Viewer: block mutating operations (except change-password handled above)
    if (session.role === "viewer" && req.method !== "GET") {
      return res.status(403).json({ error: "Viewers have read-only access" });
    }
    // Attach session to request for downstream handlers
    (req as any)._session = session;
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
      "-t", "fontSize=14",
      "-t", "scrollback=10000",
      "-t", "allowProposedApi=true",
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
    const wsToken = extractToken(req as any);
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

  // --- User management (admin only) ---
  function requireAdmin(req: any, res: any): SessionInfo | null {
    const session = (req as any)._session as SessionInfo | undefined;
    if (!session || session.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return null;
    }
    return session;
  }

  app.get("/api/users", (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({ users: listUsers() });
  });

  app.post("/api/users", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { username, password, role } = req.body;
    if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }
    if (username.length < 2) { res.status(400).json({ error: "Username too short (min 2)" }); return; }
    if (password.length < 4) { res.status(400).json({ error: "Password too short (min 4)" }); return; }
    const userRole: UserRole = role === "viewer" ? "viewer" : "admin";
    try {
      addUser(username.trim(), password, userRole);
      res.json({ ok: true, username: username.trim(), role: userRole });
    } catch (e: any) { res.status(409).json({ error: e.message }); }
  });

  app.delete("/api/users/:username", (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    const target = req.params.username;
    if (target === session.username) { res.status(400).json({ error: "Cannot delete yourself" }); return; }
    try {
      // Remove all sessions for deleted user
      for (const [token, info] of sessions) {
        if (info.username === target) sessions.delete(token);
      }
      deleteUser(target);
      res.json({ ok: true });
    } catch (e: any) { res.status(404).json({ error: e.message }); }
  });

  app.post("/api/users/:username/reset-password", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { password } = req.body;
    if (!password || password.length < 4) { res.status(400).json({ error: "Password too short (min 4)" }); return; }
    try {
      resetPassword(req.params.username, password);
      // Invalidate target user's sessions
      for (const [token, info] of sessions) {
        if (info.username === req.params.username) sessions.delete(token);
      }
      res.json({ ok: true });
    } catch (e: any) { res.status(404).json({ error: e.message }); }
  });

  // --- Backward compat: /api/status redirects to first project ---
  app.get("/api/status", (_req, res) => {
    const projects = getProjects();
    if (projects.length === 0) { res.json({ project: "none", roles: [] }); return; }
    res.redirect(`/api/projects/${projects[0].slug}/status`);
  });

  // Login page
  app.get("/login", (_req, res) => {
    const loginSrc = path.join(__dirname, "..", "..", "src", "server", "login.html");
    const loginDist = path.join(__dirname, "login.html");
    const loginPath = fs.existsSync(loginSrc) ? loginSrc : loginDist;
    if (!fs.existsSync(loginPath)) { res.send("Login page not found."); return; }
    res.type("html").sendFile(path.resolve(loginPath));
  });

  // Serve static frontend
  app.get("/", (_req, res) => {
    const htmlPath = path.join(__dirname, "..", "..", "src", "server", "frontend.html");
    const distPath = path.join(__dirname, "frontend.html");
    const filePath = fs.existsSync(htmlPath) ? htmlPath : distPath;
    if (!fs.existsSync(filePath)) { res.send("Frontend not found."); return; }
    res.type("html").sendFile(path.resolve(filePath));
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
    console.log(`\n  ${hasAnyUser() ? "Users configured. Login at /login" : "No users. First visitor will create admin account."}\n`);
  });
}


