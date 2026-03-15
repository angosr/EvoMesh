import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/loader.js";
import { readPid } from "../process/registry.js";
import { runtimeDir } from "../utils/paths.js";

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

  // --- ttyd management ---

  function startTtyd(roleName: string, basePort: number): TtydProcess | null {
    const session = `evomesh-${roleName}`;

    // Check tmux session exists
    try {
      execFileSync("tmux", ["has-session", "-t", session], { stdio: "ignore" });
    } catch {
      return null;
    }

    const ttydPort = basePort;

    // Kill existing ttyd on this port
    try {
      execFileSync("fuser", ["-k", `${ttydPort}/tcp`], { stdio: "ignore" });
    } catch {}

    // Start ttyd attached to the tmux session (writable)
    const proc = spawn("ttyd", [
      "--port", String(ttydPort),
      "--writable",              // allow input
      "--base-path", `/${roleName}`,  // serve at /roleName/
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

  // --- REST API ---

  app.get("/api/status", (_req, res) => {
    try {
      const config = loadConfig(root);
      const roles = Object.entries(config.roles).map(([name, rc]) => {
        const info = readPid(root, name);
        const ttyd = ttydProcesses.get(name);
        return {
          name,
          type: rc.type,
          loop_interval: rc.loop_interval,
          description: rc.description,
          running: info?.alive ?? false,
          pid: info?.pid ?? null,
          ttyd_port: ttyd?.port ?? null,
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
      res.send("Frontend not found.");
    }
  });

  // Start ttyd instances for running roles
  ensureTtydRunning();
  // Re-check periodically
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
    console.log(`    http://0.0.0.0:${port}`);
    console.log(`\n  ttyd terminals:`);
    for (const [name, t] of ttydProcesses) {
      console.log(`    ${name}: http://0.0.0.0:${t.port}/${name}/`);
    }
    console.log(`\n  Press Ctrl+C to stop.\n`);
  });
}
