import http from "node:http";
import { loadConfig } from "../config/loader.js";
import { isRoleRunning, getContainerPort, getContainerState, ensureImage, containerName, centralContainerName } from "../process/container.js";
import type { ServerContext } from "./index.js";

export interface TtydProcess {
  port: number;
  roleName: string;
  projectSlug: string;
  userStopped?: boolean;
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
            const port = getContainerPort(containerName(project.slug, roleName));
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

    // Restore admin container registration if running but not tracked
    if (!ctx.ttydProcesses.has("central/ai")) {
      try {
        const state = getContainerState(centralContainerName());
        if (state === "running") {
          const port = getContainerPort(centralContainerName());
          if (port) ctx.ttydProcesses.set("central/ai", { port, roleName: "ai", projectSlug: "central" });
        }
      } catch {}
    }
  } catch {}
}

const COOKIE_NAME = "evomesh_terminal_auth";

/**
 * Extract and validate session token from query param, header, or cookie.
 * Returns the valid token string, or undefined if not authenticated.
 */
function extractTerminalToken(ctx: ServerContext, req: { headers: Record<string, any>; url?: string }): string | undefined {
  // 1. Query param or Authorization header
  const token = ctx.extractToken(req as any);
  if (token && ctx.sessions.has(token)) return token;

  // 2. Cookie fallback (for ttyd sub-resources and WebSocket)
  const cookie = (req.headers.cookie as string) || "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (match) {
    const cookieToken = decodeURIComponent(match[1]);
    if (ctx.sessions.has(cookieToken)) return cookieToken;
  }

  return undefined;
}

function proxyRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  targetPort: number,
  extraHeaders?: Record<string, string>,
): void {
  const proxyReq = http.request({
    hostname: "127.0.0.1", port: targetPort, path: req.url, method: req.method, headers: req.headers,
  }, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    if (extraHeaders) Object.assign(headers, extraHeaders);
    res.writeHead(proxyRes.statusCode || 502, headers);
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

    // Auth: token from query param, header, or cookie
    const token = extractTerminalToken(ctx, req);
    if (!token) {
      res.status(401).send("Not authenticated. Please log in first.");
      return;
    }

    // ACL: verify user owns this project
    const session = ctx.sessions.get(token);
    const slug = match[1];
    if (slug !== "central") {
      const project = ctx.getProject(slug, session?.linuxUser);
      if (!project) { res.status(403).send("Access denied."); return; }
    }

    const key = `${slug}/${match[2]}`;
    const ttyd = ctx.ttydProcesses.get(key);
    if (!ttyd) { res.status(404).send("Terminal not available. Is the role running?"); return; }

    // Set auth cookie so ttyd sub-resources and WebSocket get auth
    const cookieHeader = `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/terminal/`;

    // Strip the /terminal/{slug}/{role} prefix — container's ttyd serves at /
    const originalUrl = req.url;
    req.url = match[3] || "/";
    proxyRequest(req, res as unknown as http.ServerResponse, ttyd.port, { "Set-Cookie": cookieHeader });
    req.url = originalUrl; // restore for downstream middleware
  });

  // WebSocket proxy — validate via token or cookie before upgrading
  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    const match = url.match(/^\/terminal\/([a-z0-9_-]+)\/([a-zA-Z0-9_-]+)\//);
    if (!match) return;

    // Auth: token from query param or cookie
    const token = extractTerminalToken(ctx, req);
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // ACL: verify user owns this project
    const session = ctx.sessions.get(token);
    const wsSlug = match[1];
    if (wsSlug !== "central") {
      const project = ctx.getProject(wsSlug, session?.linuxUser);
      if (!project) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    const key = `${wsSlug}/${match[2]}`;
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
