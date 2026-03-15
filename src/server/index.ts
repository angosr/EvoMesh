import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/loader.js";
import { readPid, listRunning } from "../process/registry.js";
import { runtimeDir } from "../utils/paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROLE_NAME_RE = /^[a-zA-Z0-9_-]+$/;

interface TmuxBridge {
  roleName: string;
  session: string;
  clients: Set<WebSocket>;
  pollInterval: ReturnType<typeof setInterval> | null;
}

export function startServer(root: string, port: number) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const bridges: Map<string, TmuxBridge> = new Map();

  // --- REST API ---

  app.get("/api/status", (_req, res) => {
    try {
      const config = loadConfig(root);
      const roles = Object.entries(config.roles).map(([name, rc]) => {
        const info = readPid(root, name);
        return {
          name,
          type: rc.type,
          loop_interval: rc.loop_interval,
          description: rc.description,
          running: info?.alive ?? false,
          pid: info?.pid ?? null,
        };
      });
      res.json({ project: config.name, roles });
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
    // Return last 50KB of log
    const stat = fs.statSync(logPath);
    const start = Math.max(0, stat.size - 50000);
    const stream = fs.createReadStream(logPath, { start });
    stream.pipe(res);
  });

  // Serve static frontend
  app.get("/", (_req, res) => {
    const htmlPath = path.join(__dirname, "..", "..", "src", "server", "frontend.html");
    // Also check dist path
    const distPath = path.join(__dirname, "frontend.html");
    const filePath = fs.existsSync(htmlPath) ? htmlPath : distPath;
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.send("Frontend not found. Expected at: " + htmlPath);
    }
  });

  // --- WebSocket: terminal bridge ---

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const roleName = url.searchParams.get("role");

    if (!roleName || !ROLE_NAME_RE.test(roleName)) {
      ws.send(JSON.stringify({ type: "error", message: "Missing or invalid ?role= parameter" }));
      ws.close();
      return;
    }

    const session = `evomesh-${roleName}`;

    // Check if tmux session exists
    try {
      execFileSync("tmux", ["has-session", "-t", session], { stdio: "ignore" });
    } catch {
      ws.send(JSON.stringify({ type: "error", message: `tmux session '${session}' not found. Is the role running?` }));
      ws.close();
      return;
    }

    // Get or create bridge for this role
    let bridge = bridges.get(roleName);
    if (!bridge) {
      bridge = { roleName, session, clients: new Set(), pollInterval: null };
      bridges.set(roleName, bridge);
    }
    bridge.clients.add(ws);

    // Send initial screen capture
    try {
      const capture = execFileSync(
        "tmux", ["capture-pane", "-t", session, "-p", "-S", "-200"],
        { encoding: "utf-8", maxBuffer: 1024 * 1024 }
      );
      ws.send(JSON.stringify({ type: "output", data: capture }));
    } catch {}

    // Start polling tmux for updates if not already
    if (!bridge.pollInterval) {
      let lastCapture = "";
      bridge.pollInterval = setInterval(() => {
        if (bridge!.clients.size === 0) {
          clearInterval(bridge!.pollInterval!);
          bridge!.pollInterval = null;
          return;
        }
        try {
          const capture = execFileSync(
            "tmux", ["capture-pane", "-t", session, "-p", "-S", "-50"],
            { encoding: "utf-8", maxBuffer: 1024 * 1024 }
          );
          if (capture !== lastCapture) {
            lastCapture = capture;
            const msg = JSON.stringify({ type: "output", data: capture });
            for (const client of bridge!.clients) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
              }
            }
          }
        } catch {}
      }, 500);
    }

    // Receive input from browser and send to tmux
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "input" && typeof msg.data === "string") {
          execFileSync("tmux", ["send-keys", "-t", session, "-l", msg.data], {
            stdio: "ignore",
          });
        } else if (msg.type === "resize" && msg.cols && msg.rows) {
          const cols = Math.max(10, Math.min(500, parseInt(msg.cols, 10)));
          const rows = Math.max(10, Math.min(500, parseInt(msg.rows, 10)));
          if (!isNaN(cols) && !isNaN(rows)) {
            execFileSync("tmux", ["resize-window", "-t", session, "-x", String(cols), "-y", String(rows)], {
              stdio: "ignore",
            });
          }
        }
      } catch {}
    });

    ws.on("close", () => {
      bridge?.clients.delete(ws);
    });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`\n  EvoMesh Web UI running at:`);
    console.log(`    http://localhost:${port}`);
    console.log(`\n  Press Ctrl+C to stop.\n`);
  });
}
