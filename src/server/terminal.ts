import http from "node:http";
import { loadConfig } from "../config/loader.js";
import { isRoleRunning, getContainerPort, startRole, ensureImage } from "../process/container.js";
import type { ServerContext } from "./index.js";

export interface TtydProcess {
  port: number;
  roleName: string;
  projectSlug: string;
}

export function ensureTtydRunning(ctx: ServerContext): void {
  try {
    ensureImage();
    const projects = ctx.getProjects();
    let portOffset = 0;
    for (const project of projects) {
      try {
        const config = loadConfig(project.root);
        for (const [roleName, roleConfig] of Object.entries(config.roles)) {
          const key = `${project.slug}/${roleName}`;
          portOffset++;
          if (ctx.ttydProcesses.has(key)) continue;

          // Check if container is running
          if (isRoleRunning(project.root, roleName)) {
            const port = getContainerPort(`evomesh-${project.slug}-${roleName}`);
            if (port) {
              ctx.ttydProcesses.set(key, { port, roleName, projectSlug: project.slug });
            }
            continue;
          }

          // Start container for roles that should be running
          // (only start if explicitly requested via API, not auto-start all)
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
  proxyReq.on("error", () => { res.writeHead(502); res.end("Terminal not ready"); });
  req.pipe(proxyReq);
}

export function setupTerminalProxy(
  server: http.Server,
  app: import("express").Express,
  ctx: ServerContext,
): void {
  // HTTP proxy: /terminal/{slug}/{role}/* → strip prefix, forward to container's ttyd at /
  app.use((req, res, next) => {
    const match = req.url.match(/^\/terminal\/([a-z0-9_-]+)\/([a-zA-Z0-9_-]+)(\/.*)?$/);
    if (!match) return next();
    const key = `${match[1]}/${match[2]}`;
    const ttyd = ctx.ttydProcesses.get(key);
    if (!ttyd) { res.status(404).send("Terminal not available. Is the role running?"); return; }
    // Strip the /terminal/{slug}/{role} prefix — container's ttyd serves at /
    const originalUrl = req.url;
    req.url = match[3] || "/";
    proxyRequest(req, res as unknown as http.ServerResponse, ttyd.port);
    req.url = originalUrl; // restore for downstream middleware
  });

  // WebSocket proxy (no auth needed — ttyd binds localhost only)
  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    const match = url.match(/^\/terminal\/([a-z0-9_-]+)\/([a-zA-Z0-9_-]+)\//);
    if (!match) return;
    const key = `${match[1]}/${match[2]}`;
    const ttyd = ctx.ttydProcesses.get(key);
    if (!ttyd) { socket.destroy(); return; }

    // Strip /terminal/{slug}/{role} prefix for container's ttyd
    const wsPath = url.replace(/^\/terminal\/[a-z0-9_-]+\/[a-zA-Z0-9_-]+/, "") || "/";
    const proxyReq = http.request({
      hostname: "127.0.0.1", port: ttyd.port, path: wsPath, method: "GET", headers: req.headers,
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
