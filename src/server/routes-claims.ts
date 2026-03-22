import path from "node:path";
import fs from "node:fs";
import { loadConfig } from "../config/loader.js";
import { isRoleRunning } from "../process/container.js";
import { errorMessage } from "../utils/error.js";
import { requireProjectRole, reqLinuxUser } from "./routes.js";
import type { ServerContext } from "./index.js";
import type { ClaimsData } from "../config/schema.js";

function readClaims(projectRoot: string): ClaimsData {
  const claimsPath = path.join(projectRoot, ".evomesh", "shared", "claims.json");
  try {
    if (fs.existsSync(claimsPath)) {
      return JSON.parse(fs.readFileSync(claimsPath, "utf-8"));
    }
  } catch { /* malformed or missing */ }
  return { claims: [] };
}

export function registerClaimsRoutes(app: import("express").Express, ctx: ServerContext): void {

  // --- Claims list ---
  app.get("/api/projects/:slug/claims", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "viewer")) return;
    const data = readClaims(project.root);
    res.json(data);
  });

  // --- Load view: per-role claim counts ---
  app.get("/api/projects/:slug/load", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "viewer")) return;

    try {
      const config = loadConfig(project.root);
      const claims = readClaims(project.root);

      const roles = Object.entries(config.roles).map(([name]) => {
        const running = isRoleRunning(project.root, name);
        const roleClaims = claims.claims.filter(c => c.assignedTo === name && c.status !== "completed");
        const activeClaims = roleClaims.filter(c => c.status === "in-progress" || c.status === "in-review").length;
        const blockedClaims = roleClaims.filter(c => c.status === "blocked").length;
        const unclaimedClaims = roleClaims.filter(c => c.status === "unclaimed").length;
        return { name, running, activeClaims, blockedClaims, unclaimedClaims };
      });

      res.json({ roles });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });
}
