import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { execFileSync } from "node:child_process";
import { spawn as ptySpawn, type IPty } from "node-pty";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/loader.js";
import { readPid } from "../process/registry.js";
import { runtimeDir } from "../utils/paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROLE_NAME_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Each WebSocket client gets its own `tmux attach-session` PTY process.
 * This gives xterm.js the raw ANSI byte stream — no capture-pane snapshot issues.
 */
interface ClientSession {
  pty: IPty;
  roleName: string;
}

export function startServer(root: string, port: number) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

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
    const stat = fs.statSync(logPath);
    const start = Math.max(0, stat.size - 50000);
    const stream = fs.createReadStream(logPath, { start });
    stream.pipe(res);
  });

  // Serve static frontend
  app.get("/", (_req, res) => {
    const htmlPath = path.join(__dirname, "..", "..", "src", "server", "frontend.html");
    const distPath = path.join(__dirname, "frontend.html");
    const filePath = fs.existsSync(htmlPath) ? htmlPath : distPath;
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.send("Frontend not found. Expected at: " + htmlPath);
    }
  });

  // --- WebSocket: raw PTY bridge via tmux attach ---

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const roleName = url.searchParams.get("role");
    const cols = Math.max(10, Math.min(500, parseInt(url.searchParams.get("cols") || "120", 10)));
    const rows = Math.max(10, Math.min(500, parseInt(url.searchParams.get("rows") || "40", 10)));

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
      ws.send(JSON.stringify({ type: "error", message: `Session '${session}' not found. Is the role running?` }));
      ws.close();
      return;
    }

    // Spawn a `tmux attach-session` process via node-pty.
    // This gives us the raw byte stream that xterm.js needs.
    // Using -r (read-only) so multiple web clients don't fight for input;
    // input is sent separately via tmux send-keys.
    let pty: IPty;
    try {
      pty = ptySpawn("tmux", ["attach-session", "-t", session, "-r"], {
        name: "xterm-256color",
        cols,
        rows,
        cwd: root,
      });
    } catch (e: any) {
      ws.send(JSON.stringify({ type: "error", message: `Failed to attach: ${e.message}` }));
      ws.close();
      return;
    }

    // PTY output → WebSocket (binary for efficiency)
    pty.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    pty.onExit(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("\r\n\x1b[33m[tmux session ended]\x1b[0m\r\n");
        ws.close();
      }
    });

    // WebSocket messages → tmux
    ws.on("message", (raw) => {
      try {
        const str = raw.toString();
        // Try JSON first (structured messages)
        if (str.startsWith("{")) {
          const msg = JSON.parse(str);
          if (msg.type === "input" && typeof msg.data === "string") {
            execFileSync("tmux", ["send-keys", "-t", session, "-l", msg.data], {
              stdio: "ignore",
            });
          } else if (msg.type === "resize") {
            const c = Math.max(10, Math.min(500, parseInt(msg.cols, 10)));
            const r = Math.max(10, Math.min(500, parseInt(msg.rows, 10)));
            if (!isNaN(c) && !isNaN(r)) {
              pty.resize(c, r);
            }
          }
        } else {
          // Raw text — send directly as keystrokes
          execFileSync("tmux", ["send-keys", "-t", session, "-l", str], {
            stdio: "ignore",
          });
        }
      } catch {}
    });

    ws.on("close", () => {
      pty.kill();
    });
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`\n  EvoMesh Web UI running at:`);
    console.log(`    http://0.0.0.0:${port}`);
    console.log(`\n  Press Ctrl+C to stop.\n`);
  });
}
