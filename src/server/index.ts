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
import { exists } from "../utils/fs.js";

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

  // WebSocket proxy
  server.on("upgrade", (req, socket, head) => {
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
      const { url, path: localPath } = req.body;
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
        projectRoot = path.resolve(localPath);
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
      const config = smartInit(projectRoot, projectName);

      // Add to workspace
      const project = addProject(projectName, projectRoot);
      const slug = slugify(projectName);

      // Auto-start lead role
      const leadName = Object.entries(config.roles).find(([, rc]) => rc.type === "lead")?.[0];
      if (leadName) {
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

  // --- Backward compat: /api/status redirects to first project ---
  app.get("/api/status", (_req, res) => {
    const projects = getProjects();
    if (projects.length === 0) { res.json({ project: "none", roles: [] }); return; }
    res.redirect(`/api/projects/${projects[0].slug}/status`);
  });

  // Serve static frontend
  app.get("/", (_req, res) => {
    const htmlPath = path.join(__dirname, "..", "..", "src", "server", "frontend.html");
    const distPath = path.join(__dirname, "frontend.html");
    const filePath = fs.existsSync(htmlPath) ? htmlPath : distPath;
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.send("Frontend not found.");
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

  server.listen(port, "0.0.0.0", () => {
    console.log(`\n  EvoMesh Web UI running at:`);
    console.log(`    http://localhost:${port}`);
    console.log(`\n  Terminals proxied at /terminal/{project}/{role}/\n`);
  });
}
