import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import YAML from "yaml";
import { loadConfig } from "../config/loader.js";
import { readPid } from "../process/registry.js";
import { runtimeDir, roleDir, evomeshDir, expandHome } from "../utils/paths.js";
import { spawnRole, stopRole } from "../process/spawner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROLE_NAME_RE = /^[a-zA-Z0-9_-]+$/;

interface TtydProcess {
  port: number;
  process: ReturnType<typeof spawn>;
  roleName: string;
}

export function startServer(root: string, port: number) {
  const app = express();
  const server = http.createServer(app);

  const ttydProcesses: Map<string, TtydProcess> = new Map();

  // --- ttyd management (bind localhost only, proxied through main server) ---

  function startTtyd(roleName: string, ttydPort: number): TtydProcess | null {
    const session = `evomesh-${roleName}`;

    try {
      execFileSync("tmux", ["has-session", "-t", session], { stdio: "ignore" });
    } catch {
      return null;
    }

    try {
      execFileSync("fuser", ["-k", `${ttydPort}/tcp`], { stdio: "ignore" });
    } catch {}

    const proc = spawn("ttyd", [
      "--port", String(ttydPort),
      "--interface", "127.0.0.1",
      "--writable",
      "--base-path", `/terminal/${roleName}`,
      "tmux", "attach-session", "-t", session,
    ], {
      detached: true,
      stdio: "ignore",
      cwd: root,
    });
    proc.unref();

    return { port: ttydPort, process: proc, roleName };
  }

  function ensureTtydRunning() {
    try {
      const config = loadConfig(root);
      let portOffset = 0;
      for (const name of Object.keys(config.roles)) {
        if (ttydProcesses.has(name)) continue;
        const info = readPid(root, name);
        if (!info?.alive) continue;

        const ttydPort = port + 1 + portOffset;
        const proc = startTtyd(name, ttydPort);
        if (proc) {
          ttydProcesses.set(name, proc);
        }
        portOffset++;
      }
    } catch {}
  }

  // --- Reverse proxy: /terminal/{role}/* -> localhost:ttydPort ---

  function proxyRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    targetPort: number
  ) {
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on("error", () => {
      res.writeHead(502);
      res.end("ttyd not ready");
    });
    req.pipe(proxyReq);
  }

  // HTTP proxy for ttyd assets/API
  // Use a raw middleware to preserve the full URL path
  app.use((req, res, next) => {
    const match = req.url.match(/^\/terminal\/([a-zA-Z0-9_-]+)(\/.*)?$/);
    if (!match) return next();

    const roleName = match[1];
    const ttyd = ttydProcesses.get(roleName);
    if (!ttyd) {
      res.status(404).send("Terminal not available. Is the role running?");
      return;
    }
    // Forward with full original URL intact
    proxyRequest(req, res as unknown as http.ServerResponse, ttyd.port);
  });

  // WebSocket proxy for ttyd (handles upgrade events)
  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    const match = url.match(/^\/terminal\/([a-zA-Z0-9_-]+)\//);
    if (!match) return; // not a terminal WS, ignore

    const roleName = match[1];
    const ttyd = ttydProcesses.get(roleName);
    if (!ttyd) {
      socket.destroy();
      return;
    }

    const proxyReq = http.request({
      hostname: "127.0.0.1",
      port: ttyd.port,
      path: req.url,
      method: "GET",
      headers: req.headers,
    });

    proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
      // Send the 101 response back to the client
      let responseHead = `HTTP/1.1 101 Switching Protocols\r\n`;
      for (const [key, val] of Object.entries(proxyRes.headers)) {
        if (val) responseHead += `${key}: ${Array.isArray(val) ? val.join(", ") : val}\r\n`;
      }
      responseHead += "\r\n";

      socket.write(responseHead);
      if (proxyHead.length) socket.write(proxyHead);
      if (head.length) proxySocket.write(head);

      // Bidirectional pipe
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

  // --- REST API ---

  app.get("/api/status", (_req, res) => {
    try {
      const config = loadConfig(root);
      const roles = Object.entries(config.roles).map(([name, rc]) => {
        const info = readPid(root, name);
        const ttyd = ttydProcesses.get(name);

        // Check login status for this role's account
        const accountDir = expandHome(config.accounts[rc.account] || "~/.claude");
        let needsLogin = false;
        try {
          // Claude Code stores credentials as .credentials.json (dot prefix)
          const dotCreds = path.join(accountDir, ".credentials.json");
          const plainCreds = path.join(accountDir, "credentials.json");
          const credsPath = fs.existsSync(dotCreds) ? dotCreds : plainCreds;
          if (!fs.existsSync(credsPath)) {
            needsLogin = true;
          } else {
            const creds = fs.readFileSync(credsPath, "utf-8").trim();
            if (!creds || creds === "{}" || creds === "null") needsLogin = true;
          }
        } catch { needsLogin = true; }

        // Also check log for login prompts
        if (!needsLogin && info?.alive) {
          try {
            const logPath = path.join(runtimeDir(root), `${name}.log`);
            if (fs.existsSync(logPath)) {
              const stat = fs.statSync(logPath);
              const start = Math.max(0, stat.size - 5000);
              const tail = fs.readFileSync(logPath, { encoding: "utf-8" }).slice(start);
              if (/login|sign in|authenticate|oauth|expired/i.test(tail)) {
                needsLogin = true;
              }
            }
          } catch {}
        }

        return {
          name,
          type: rc.type,
          loop_interval: rc.loop_interval,
          description: rc.description,
          running: info?.alive ?? false,
          pid: info?.pid ?? null,
          terminal: ttyd ? `/terminal/${name}/` : null,
          account: rc.account,
          needsLogin,
        };
      });
      res.json({ project: config.name, roles, accounts: config.accounts });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/roles/:name/log", (req, res) => {
    if (!ROLE_NAME_RE.test(req.params.name)) {
      res.status(400).json({ error: "Invalid role name" });
      return;
    }
    const logPath = path.join(runtimeDir(root), `${req.params.name}.log`);
    if (!fs.existsSync(logPath)) {
      res.status(404).json({ error: "Log not found" });
      return;
    }
    const stat = fs.statSync(logPath);
    const start = Math.max(0, stat.size - 50000);
    const stream = fs.createReadStream(logPath, { start });
    stream.pipe(res);
  });

  // --- SSE: streaming role status feed ---
  app.get("/api/feed", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendEvent = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const gather = () => {
      try {
        const config = loadConfig(root);
        const entries: Array<{ role: string; type: string; running: boolean; status: string }> = [];

        for (const [name, rc] of Object.entries(config.roles)) {
          const info = readPid(root, name);
          const running = info?.alive ?? false;

          let status = running ? "Running" : "Stopped";
          try {
            const stm = fs.readFileSync(
              path.join(roleDir(root, name), "memory", "short-term.md"), "utf-8"
            );
            const bullets = stm.match(/^- .+$/gm);
            if (bullets && bullets.length > 0) {
              const recent = bullets.filter(b => !b.startsWith("- 下一")).pop() || bullets[bullets.length - 1];
              status = recent.replace(/^- /, "");
            }
          } catch {}

          entries.push({ role: name, type: rc.type, running, status });
        }
        sendEvent({ type: "status", entries, ts: new Date().toISOString() });
      } catch {}
    };

    gather();
    const timer = setInterval(gather, 5000);
    _req.on("close", () => clearInterval(timer));
  });

  // --- Chat: send message to lead's inbox ---
  app.use(express.json());

  app.post("/api/chat", (req, res) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        res.status(400).json({ error: "Empty message" });
        return;
      }

      const config = loadConfig(root);
      const leadName = Object.entries(config.roles).find(([, rc]) => rc.type === "lead")?.[0];
      if (!leadName) {
        res.status(404).json({ error: "No lead role found" });
        return;
      }

      const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
      const filename = `${ts}_user_chat.md`;
      const inboxPath = path.join(roleDir(root, leadName), "inbox", filename);

      const content = `---\nfrom: user\npriority: high\ntype: chat\n---\n\n${message.trim()}\n`;
      fs.mkdirSync(path.dirname(inboxPath), { recursive: true });
      fs.writeFileSync(inboxPath, content, "utf-8");

      const leadSession = `evomesh-${leadName}`;
      try {
        execFileSync("tmux", ["has-session", "-t", leadSession], { stdio: "ignore" });
        const prompt = `[用户消息] ${message.trim()}`;
        execFileSync("tmux", ["send-keys", "-t", leadSession, "-l", prompt], { stdio: "ignore" });
        execFileSync("tmux", ["send-keys", "-t", leadSession, "Enter"], { stdio: "ignore" });
      } catch {}

      res.json({ ok: true, delivered_to: leadName, filename });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Chat history ---
  app.get("/api/chat/history", (_req, res) => {
    try {
      const config = loadConfig(root);
      const leadName = Object.entries(config.roles).find(([, rc]) => rc.type === "lead")?.[0];
      if (!leadName) { res.json({ messages: [] }); return; }

      const inboxDir = path.join(roleDir(root, leadName), "inbox");
      const processedDir = path.join(inboxDir, "processed");

      const readMessages = (dir: string) => {
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir)
          .filter(f => f.includes("_user_chat.md"))
          .sort()
          .slice(-50)
          .map(f => {
            const content = fs.readFileSync(path.join(dir, f), "utf-8");
            const body = content.split("---").slice(2).join("---").trim();
            const ts = f.slice(0, 15).replace(/T/, " ").replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
            return { ts, from: "user", body, processed: dir === processedDir };
          });
      };

      const messages = [...readMessages(inboxDir), ...readMessages(processedDir)].sort((a, b) => a.ts.localeCompare(b.ts));
      res.json({ messages });
    } catch {
      res.json({ messages: [] });
    }
  });

  // --- Accounts API ---

  // Auto-detect ~/.claude* directories
  app.get("/api/accounts", (_req, res) => {
    try {
      const homeDir = os.homedir();
      const entries = fs.readdirSync(homeDir, { withFileTypes: true });
      const detected = entries
        .filter(e => e.isDirectory() && e.name.startsWith(".claude"))
        .map(e => ({
          name: e.name.replace(/^\.claude/, "") || "default",
          path: `~/${e.name}`,
          fullPath: path.join(homeDir, e.name),
        }));

      // Also include accounts from project.yaml
      const config = loadConfig(root);
      const configured = Object.entries(config.accounts).map(([name, p]) => ({
        name,
        path: p,
        fullPath: expandHome(p),
      }));

      // Merge: configured first, then detected ones not already listed
      const configuredPaths = new Set(configured.map(a => a.fullPath));
      const all = [
        ...configured,
        ...detected.filter(d => !configuredPaths.has(d.fullPath)),
      ];

      // Check login status for each account
      const accounts = all.map(a => {
        let needsLogin = false;
        try {
          const dotCreds = path.join(a.fullPath, ".credentials.json");
          const plainCreds = path.join(a.fullPath, "credentials.json");
          const credsPath = fs.existsSync(dotCreds) ? dotCreds : plainCreds;
          if (!fs.existsSync(credsPath)) {
            needsLogin = true;
          } else {
            const creds = fs.readFileSync(credsPath, "utf-8").trim();
            if (!creds || creds === "{}" || creds === "null") {
              needsLogin = true;
            }
          }
        } catch {
          needsLogin = true;
        }
        return { ...a, needsLogin };
      });

      res.json({ accounts });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Switch account for a role (updates project.yaml, restarts role with auto-loop)
  app.post("/api/roles/:name/account", (req, res) => {
    const roleName = req.params.name;
    if (!ROLE_NAME_RE.test(roleName)) {
      res.status(400).json({ error: "Invalid role name" });
      return;
    }

    try {
      const { accountName, accountPath: rawPath } = req.body;
      if (!accountName || typeof accountName !== "string") {
        res.status(400).json({ error: "Missing accountName" });
        return;
      }

      const config = loadConfig(root);
      const rc = config.roles[roleName];
      if (!rc) {
        res.status(404).json({ error: `Role "${roleName}" not found` });
        return;
      }

      // Ensure account exists in config.accounts
      if (rawPath && !config.accounts[accountName]) {
        config.accounts[accountName] = rawPath;
      }
      if (!config.accounts[accountName]) {
        res.status(400).json({ error: `Account "${accountName}" not found` });
        return;
      }

      // Update role's account
      const oldAccount = rc.account;
      rc.account = accountName;

      // Save project.yaml
      const yamlPath = path.join(evomeshDir(root), "project.yaml");
      fs.writeFileSync(yamlPath, YAML.stringify(config), "utf-8");

      // Stop the role if running
      const wasRunning = readPid(root, roleName)?.alive ?? false;
      if (wasRunning) {
        stopRole(root, roleName);

        // Clean up ttyd for this role
        const ttyd = ttydProcesses.get(roleName);
        if (ttyd) {
          try { ttyd.process.kill(); } catch {}
          ttydProcesses.delete(roleName);
        }

        // Wait a moment for cleanup, then restart
        setTimeout(() => {
          try {
            const freshConfig = loadConfig(root);
            const freshRc = freshConfig.roles[roleName];
            if (freshRc) {
              spawnRole(root, roleName, freshRc, freshConfig);
              // ttyd will be picked up by ensureTtydRunning
              setTimeout(ensureTtydRunning, 3000);
            }
          } catch (e: any) {
            console.error(`Failed to restart ${roleName}:`, e.message);
          }
        }, 2000);
      }

      res.json({
        ok: true,
        role: roleName,
        oldAccount,
        newAccount: accountName,
        restarted: wasRunning,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Serve static frontend
  app.get("/", (_req, res) => {
    const htmlPath = path.join(__dirname, "..", "..", "src", "server", "frontend.html");
    const distPath = path.join(__dirname, "frontend.html");
    const filePath = fs.existsSync(htmlPath) ? htmlPath : distPath;
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.send("Frontend not found.");
    }
  });

  // Start ttyd instances
  ensureTtydRunning();
  setInterval(ensureTtydRunning, 10000);

  // Cleanup on exit
  const cleanup = () => {
    for (const [, t] of ttydProcesses) {
      try { t.process.kill(); } catch {}
    }
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  server.listen(port, "0.0.0.0", () => {
    console.log(`\n  EvoMesh Web UI running at:`);
    console.log(`    http://localhost:${port}`);
    console.log(`\n  Terminals proxied at /terminal/{role}/\n`);
  });
}
