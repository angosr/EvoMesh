import http from "node:http";
import { execFileSync, spawn } from "node:child_process";
import { loadConfig } from "../config/loader.js";
import { readPid } from "../process/registry.js";
import type { ServerContext } from "./index.js";

export interface TtydProcess {
  port: number;
  process: ReturnType<typeof spawn>;
  roleName: string;
  projectSlug: string;
}

export function startTtyd(
  ctx: ServerContext,
  projectSlug: string,
  projectRoot: string,
  roleName: string,
  ttydPort: number,
): TtydProcess | null {
  const session = ctx.tmuxSession(projectSlug, roleName);
  try {
    execFileSync("tmux", ["has-session", "-t", session], { stdio: "ignore" });
  } catch { return null; }

  try { execFileSync("fuser", ["-k", `${ttydPort}/tcp`], { stdio: "ignore" }); } catch {}

  const basePath = `/terminal/${projectSlug}/${roleName}`;
  const proc = spawn("ttyd", [
    "--port", String(ttydPort),
    "--interface", "127.0.0.1",
    "--writable",
    "-t", "fontSize=14",
    "-t", "scrollback=10000",
    "-t", "allowProposedApi=true",
    "--base-path", basePath,
    "tmux", "attach-session", "-t", session,
  ], { detached: true, stdio: "ignore", cwd: projectRoot });
  proc.unref();

  return { port: ttydPort, process: proc, roleName, projectSlug };
}

export function ensureTtydRunning(ctx: ServerContext): void {
  try {
    const projects = ctx.getProjects();
    let portOffset = 0;
    for (const project of projects) {
      try {
        const config = loadConfig(project.root);
        for (const roleName of Object.keys(config.roles)) {
          const key = `${project.slug}/${roleName}`;
          if (ctx.ttydProcesses.has(key)) { portOffset++; continue; }
          const info = readPid(project.root, roleName);
          if (!info?.alive) { portOffset++; continue; }

          const ttydPort = ctx.port + 1 + portOffset;
          const proc = startTtyd(ctx, project.slug, project.root, roleName, ttydPort);
          if (proc) ctx.ttydProcesses.set(key, proc);
          portOffset++;
        }
      } catch {}
    }
  } catch {}
}

function proxyRequest(req: http.IncomingMessage, res: http.ServerResponse, targetPort: number): void {
  const proxyReq = http.request({
    hostname: "127.0.0.1", port: targetPort, path: req.url, method: req.method, headers: req.headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", () => { res.writeHead(502); res.end("ttyd not ready"); });
  req.pipe(proxyReq);
}

export function setupTerminalProxy(
  server: http.Server,
  app: import("express").Express,
  ctx: ServerContext,
): void {
  // HTTP proxy: /terminal/{slug}/{role}/*
  app.use((req, res, next) => {
    const match = req.url.match(/^\/terminal\/([a-z0-9_-]+)\/([a-zA-Z0-9_-]+)(\/.*)?$/);
    if (!match) return next();
    const key = `${match[1]}/${match[2]}`;
    const ttyd = ctx.ttydProcesses.get(key);
    if (!ttyd) { res.status(404).send("Terminal not available"); return; }
    proxyRequest(req, res as unknown as http.ServerResponse, ttyd.port);
  });

  // WebSocket proxy (with session auth)
  server.on("upgrade", (req, socket, head) => {
    const wsToken = ctx.extractToken(req as any);
    if (!wsToken || !ctx.sessions.has(wsToken)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const url = req.url || "";
    const match = url.match(/^\/terminal\/([a-z0-9_-]+)\/([a-zA-Z0-9_-]+)\//);
    if (!match) return;
    const key = `${match[1]}/${match[2]}`;
    const ttyd = ctx.ttydProcesses.get(key);
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
}
