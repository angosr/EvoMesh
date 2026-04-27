import path from "node:path";
import os from "node:os";
import { loadConfig } from "../config/loader.js";
import { assignRoleAccountProfile, clearRoleAccountBinding, ensureAccountProfile, getAccountProfiles, resolveRoleAccount } from "../config/accounts.js";
import { evomeshDir, expandHome } from "../utils/paths.js";
import { writeYaml } from "../utils/fs.js";
import { errorMessage } from "../utils/error.js";
import { createRole, createBareRole, deleteRole, getTemplateNames } from "../roles/manager.js";
import {
  restartRole, isRoleRunning,
  getRoleLogs, switchAccount as switchContainerAccount,
} from "../process/container.js";
import type { ServerContext } from "./index.js";
import type { SessionInfo } from "./auth.js";
import { ROLE_NAME_RE, requireProjectRole, allocatePort, reqLinuxUser } from "./routes.js";
import { startRoleManaged, stopRoleManaged, recordRoleStart } from "./health.js";
import { isAutomationModeAllowed } from "../roles/runtime.js";
import { configureRoleAutomation } from "./role-automation.js";
import type { ProviderType } from "../config/schema.js";
import { detectProvider } from "../provider.js";

function fallbackAutomationMode(kind: "agent" | "terminal", provider: "claude" | "codex"): "loop" | "manual" {
  if (provider === "codex") return "manual";
  return kind === "agent" ? "loop" : "manual";
}

function validateAutomationModeInput(
  roleConfig: { kind?: "agent" | "terminal"; provider?: "claude" | "codex" },
  automationMode: unknown,
  res: import("express").Response,
): automationMode is "loop" | "prompt" | "manual" | undefined {
  if (automationMode === undefined) return true;
  const VALID_AUTOMATION = ["loop", "prompt", "manual"];
  if (!VALID_AUTOMATION.includes(automationMode as string)) {
    res.status(400).json({ error: `Invalid automation_mode. Must be one of: ${VALID_AUTOMATION.join(", ")}` });
    return false;
  }
  if (!isAutomationModeAllowed(roleConfig, automationMode as any)) {
    res.status(400).json({ error: "automation_mode is not supported for this provider/kind combination" });
    return false;
  }
  return true;
}

function validateCodexPromptInput(
  roleConfig: { provider?: "claude" | "codex" },
  automationMode: unknown,
  automationPrompt: unknown,
  existingPrompt: string | undefined,
  res: import("express").Response,
): boolean {
  const provider = roleConfig.provider || "claude";
  const mode = typeof automationMode === "string" ? automationMode : undefined;
  if (provider !== "codex" || mode !== "prompt") return true;
  const prompt = typeof automationPrompt === "string" ? automationPrompt.trim() : (existingPrompt || "").trim();
  if (!prompt) {
    res.status(400).json({ error: "Codex scheduled prompt requires a non-empty prompt" });
    return false;
  }
  return true;
}

function validateAccountProvider(
  provider: ProviderType,
  accountPath: unknown,
  res: import("express").Response,
): boolean {
  if (typeof accountPath !== "string" || !accountPath.trim()) return true;
  const accountProvider = detectProvider(accountPath);
  if (accountProvider !== provider) {
    res.status(400).json({ error: "Selected account does not match the role provider" });
    return false;
  }
  return true;
}

export function registerRoleRoutes(app: import("express").Express, ctx: ServerContext): void {

  // --- Role lifecycle ---

  app.post("/api/projects/:slug/roles/:name/start", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }
      const ttydPort = allocatePort(ctx);
      const result = startRoleManaged(ctx, project.root, project.slug, roleName, rc, config, ttydPort);
      res.json({ ok: true, ...result });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  app.post("/api/projects/:slug/roles/:name/stop", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    stopRoleManaged(ctx, project.root, project.slug, req.params.name, { userStopped: true, reason: "user-stop" });
    res.json({ ok: true });
  });

  app.post("/api/projects/:slug/roles/:name/restart", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }

      if (isRoleRunning(project.root, roleName)) {
        if (rc.launch_mode === "host") {
          stopRoleManaged(ctx, project.root, project.slug, roleName, { keepDesiredState: true, reason: "restart-host" });
          const ttydPort = allocatePort(ctx);
          const fresh = loadConfig(project.root);
          startRoleManaged(ctx, project.root, project.slug, roleName, fresh.roles[roleName], fresh, ttydPort);
        } else {
          restartRole(project.root, roleName);
          recordRoleStart(`${project.slug}/${roleName}`);
        }
      } else {
        // Stop any dead container first, then start fresh
        stopRoleManaged(ctx, project.root, project.slug, roleName, { keepDesiredState: true, reason: "restart-pre-stop" });
        const ttydPort = allocatePort(ctx);
        startRoleManaged(ctx, project.root, project.slug, roleName, rc, config, ttydPort);
      }
      res.json({ ok: true, role: roleName });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Role logs ---

  app.get("/api/projects/:slug/roles/:name/log", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "viewer")) return;
    const logs = getRoleLogs(project.root, req.params.name);
    res.type("text").send(logs);
  });

  // --- Role CRUD ---

  app.get("/api/templates", (_req, res) => {
    res.json({ templates: getTemplateNames() });
  });

  app.post("/api/projects/:slug/roles", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const {
      name, template, account, accountPath, kind, description, loop_interval,
      launch_mode, provider, model, automation_mode, automation_prompt,
    } = req.body;
    if (!name || !ROLE_NAME_RE.test(name)) { res.status(400).json({ error: "Invalid role name" }); return; }
    try {
      const config = loadConfig(project.root);
      if (config.roles[name]) { res.status(409).json({ error: `Role "${name}" already exists` }); return; }
      const roleKind = kind === "terminal" ? "terminal" : "agent";
      const normalizedProvider = provider === "codex" ? "codex" : "claude";
      if (!validateAutomationModeInput({ kind: roleKind, provider: normalizedProvider }, automation_mode, res)) return;
      if (!validateCodexPromptInput({ provider: normalizedProvider }, automation_mode, automation_prompt, undefined, res)) return;
      if (!validateAccountProvider(normalizedProvider, accountPath, res)) return;
      let accountProfileId: string | undefined;
      if (typeof accountPath === "string" && accountPath.trim()) {
        accountProfileId = ensureAccountProfile(config, normalizedProvider, accountPath, typeof account === "string" ? account : undefined);
      }
      if (roleKind === "terminal") {
        createBareRole(project.root, name, config, {
          account_profile: accountProfileId,
          description,
          loop_interval,
          launch_mode,
          provider: normalizedProvider,
          model,
          automation_mode,
          automation_prompt: typeof automation_prompt === "string" ? automation_prompt.trim() || undefined : undefined,
        });
        res.json({ ok: true, role: name, kind: roleKind });
        return;
      }

      if (!template || !getTemplateNames().includes(template)) { res.status(400).json({ error: "Invalid template" }); return; }
      createRole(project.root, name, template, config, undefined, accountProfileId);
      const rc = config.roles[name] as import("../config/schema.js").RoleConfig;
      rc.kind = "agent";
      rc.provider = normalizedProvider;
      if (description !== undefined) rc.description = description;
      if (loop_interval !== undefined) rc.loop_interval = loop_interval;
      if (launch_mode === "docker" || launch_mode === "host") rc.launch_mode = launch_mode;
      if (model !== undefined) rc.model = model;
      if (automation_mode === "loop" || automation_mode === "prompt" || automation_mode === "manual") {
        rc.automation_mode = automation_mode;
      }
      rc.automation_prompt = typeof automation_prompt === "string" ? automation_prompt.trim() || undefined : rc.automation_prompt;
      if (!validateCodexPromptInput({ provider: rc.provider }, rc.automation_mode, rc.automation_prompt, rc.automation_prompt, res)) return;
      if (automation_prompt !== undefined) {
        rc.automation_prompt = typeof automation_prompt === "string" ? automation_prompt.trim() || undefined : rc.automation_prompt;
      }
      writeYaml(path.join(evomeshDir(project.root), "project.yaml"), config);
      res.json({ ok: true, role: name, template, kind: roleKind });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  app.delete("/api/projects/:slug/roles/:name", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const config = loadConfig(project.root);
      if (!config.roles[roleName]) { res.status(404).json({ error: "Role not found" }); return; }
      stopRoleManaged(ctx, project.root, project.slug, roleName, { reason: "role-deleted" });
      deleteRole(project.root, roleName, config);
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Resource config ---

  app.post("/api/projects/:slug/roles/:name/config", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }

      const { memory, cpus, launch_mode, idle_policy, model, provider, loop_interval, description, automation_mode, automation_prompt } = req.body;

      // Track whether container-level config changed (requires restart)
      const oldMemory = rc.memory;
      const oldCpus = rc.cpus;
      const oldLaunchMode = rc.launch_mode;

      rc.memory = memory || undefined;
      rc.cpus = cpus || undefined;
      if (launch_mode === "docker" || launch_mode === "host") {
        rc.launch_mode = launch_mode;
      }
      if (idle_policy !== undefined) {
        const VALID_POLICIES = ["reset", "compact", "ignore"];
        if (!VALID_POLICIES.includes(idle_policy)) {
          res.status(400).json({ error: `Invalid idle_policy. Must be one of: ${VALID_POLICIES.join(", ")}` }); return;
        }
        rc.idle_policy = idle_policy;
      }
      if (provider !== undefined) {
        const VALID_PROVIDERS = ["claude", "codex"];
        if (!VALID_PROVIDERS.includes(provider)) {
          res.status(400).json({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` }); return;
        }
        rc.provider = provider as any;
        const boundProfileId = rc.account_profile || rc.account;
        const boundProfile = boundProfileId ? getAccountProfiles(config)[boundProfileId] : null;
        if (boundProfile && boundProfile.provider !== (rc.provider || "claude")) {
          clearRoleAccountBinding(rc);
        }
        if (!isAutomationModeAllowed(rc, rc.automation_mode || fallbackAutomationMode(rc.kind === "terminal" ? "terminal" : "agent", rc.provider || "claude"))) {
          rc.automation_mode = fallbackAutomationMode(rc.kind === "terminal" ? "terminal" : "agent", rc.provider || "claude");
        }
      }
      if (!validateAutomationModeInput({ kind: rc.kind, provider: rc.provider }, automation_mode, res)) return;
      if (model !== undefined) {
        rc.model = model;  // model validation is provider-specific, frontend handles options
      }
      if (loop_interval !== undefined) {
        rc.loop_interval = loop_interval || "10m";
      }
      if (description !== undefined) {
        rc.description = description || rc.description;
      }
      if (automation_mode !== undefined) {
        rc.automation_mode = automation_mode;
      }
      const nextPrompt = typeof automation_prompt === "string" ? automation_prompt.trim() : rc.automation_prompt;
      if (!validateCodexPromptInput({ provider: rc.provider }, automation_mode || rc.automation_mode, nextPrompt, rc.automation_prompt, res)) return;
      if (automation_prompt !== undefined) {
        rc.automation_prompt = nextPrompt || undefined;
      }
      writeYaml(path.join(evomeshDir(project.root), "project.yaml"), config);

      // Only restart if container-level config actually changed (memory, cpus, launch_mode)
      const needsRestart = rc.memory !== oldMemory || rc.cpus !== oldCpus || rc.launch_mode !== oldLaunchMode;
      let restarted = false;
      if (needsRestart && isRoleRunning(project.root, roleName)) {
        stopRoleManaged(ctx, project.root, project.slug, roleName, { keepDesiredState: true, reason: "config-change" });
        const ttydPort = allocatePort(ctx);
        const fresh = loadConfig(project.root);
        startRoleManaged(ctx, project.root, project.slug, roleName, fresh.roles[roleName], fresh, ttydPort);
        restarted = true;
      } else if (isRoleRunning(project.root, roleName)) {
        configureRoleAutomation(project.root, project.slug, roleName, rc);
      }

      res.json({
        ok: true,
        memory: rc.memory,
        cpus: rc.cpus,
        idle_policy: rc.idle_policy,
        model: rc.model,
        provider: rc.provider,
        loop_interval: rc.loop_interval,
        description: rc.description,
        automation_mode: rc.automation_mode,
        automation_prompt: rc.automation_prompt,
        restarted,
      });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });

  // --- Account switching ---

  app.post("/api/projects/:slug/roles/:name/account", (req, res) => {
    const project = ctx.getProject(req.params.slug, reqLinuxUser(req));
    if (!project || !ROLE_NAME_RE.test(req.params.name)) { res.status(400).json({ error: "Invalid" }); return; }
    if (!requireProjectRole(req, res, project.root, "owner")) return;
    const roleName = req.params.name;
    try {
      const { accountName, accountPath: rawPath, useProviderDefault } = req.body;
      const config = loadConfig(project.root);
      const rc = config.roles[roleName];
      if (!rc) { res.status(404).json({ error: "Role not found" }); return; }
      const provider = rc.provider || "claude";
      const previousAccount = resolveRoleAccount(config, rc);

      if (useProviderDefault || !rawPath) {
        clearRoleAccountBinding(rc);
        writeYaml(path.join(evomeshDir(project.root), "project.yaml"), config);
        const wasRunning = isRoleRunning(project.root, roleName);
        if (wasRunning) {
          if (rc.launch_mode === "host") {
            stopRoleManaged(ctx, project.root, project.slug, roleName, { keepDesiredState: true, reason: "account-default" });
            const ttydPort = allocatePort(ctx);
            const fresh = loadConfig(project.root);
            startRoleManaged(ctx, project.root, project.slug, roleName, fresh.roles[roleName], fresh, ttydPort);
          } else {
            restartRole(project.root, roleName);
            recordRoleStart(`${project.slug}/${roleName}`);
          }
        }
        res.json({ ok: true, oldAccount: previousAccount.label, newAccount: "provider default", restarted: wasRunning });
        return;
      }

      if (!validateAccountProvider(provider, rawPath, res)) return;

      {
        const resolved = path.resolve(expandHome(rawPath));
        const homeDir = os.homedir();
        if (!resolved.startsWith(homeDir + path.sep) && resolved !== homeDir) {
          res.status(400).json({ error: "Account path must be within home directory" }); return;
        }
      }

      const profileId = ensureAccountProfile(config, provider, rawPath, accountName);
      assignRoleAccountProfile(rc, profileId);
      writeYaml(path.join(evomeshDir(project.root), "project.yaml"), config);

      // Swap credentials in container config (preserves session)
      const newAccountPath = expandHome(rawPath);
      switchContainerAccount(project.root, roleName, newAccountPath);

      // Restart container to pick up new credentials
      const wasRunning = isRoleRunning(project.root, roleName);
      if (wasRunning) {
        if (rc.launch_mode === "host") {
          stopRoleManaged(ctx, project.root, project.slug, roleName, { keepDesiredState: true, reason: "account-switch" });
          const ttydPort = allocatePort(ctx);
          const fresh = loadConfig(project.root);
          startRoleManaged(ctx, project.root, project.slug, roleName, fresh.roles[roleName], fresh, ttydPort);
        } else {
          restartRole(project.root, roleName);
          recordRoleStart(`${project.slug}/${roleName}`);
        }
      }

      res.json({ ok: true, oldAccount: previousAccount.label, newAccount: accountName || rawPath, restarted: wasRunning });
    } catch (e: unknown) { res.status(500).json({ error: errorMessage(e) }); }
  });
}
