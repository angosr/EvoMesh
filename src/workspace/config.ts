import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exists, readYaml, writeYaml } from "../utils/fs.js";
import type { WorkspaceConfig, WorkspaceProject, Lang } from "../config/schema.js";

const WORKSPACE_DIR = path.join(os.homedir(), ".evomesh");
const WORKSPACE_FILE = path.join(WORKSPACE_DIR, "workspace.yaml");

function resolveWorkspaceFile(linuxUser?: string): string {
  if (linuxUser && linuxUser !== (process.env.USER || "user")) {
    return path.join("/home", linuxUser, ".evomesh", "workspace.yaml");
  }
  return WORKSPACE_FILE;
}

export function workspaceConfigPath(): string {
  return WORKSPACE_FILE;
}

export function loadWorkspace(linuxUser?: string): WorkspaceConfig {
  const wsFile = resolveWorkspaceFile(linuxUser);
  if (!exists(wsFile)) {
    return { projects: [] };
  }
  const raw = readYaml<any>(wsFile);
  return { projects: raw?.projects || [] };
}

export function saveWorkspace(config: WorkspaceConfig): void {
  writeYaml(WORKSPACE_FILE, config);
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function addProject(projectName: string, projectPath: string, lang: Lang = "zh"): WorkspaceProject {
  const ws = loadWorkspace();
  const absPath = path.resolve(projectPath);

  // Check not already added
  const existing = ws.projects.find(p => path.resolve(p.path) === absPath);
  if (existing) return existing;

  const project: WorkspaceProject = {
    name: projectName,
    path: absPath,
    active: true,
    lang,
  };
  ws.projects.push(project);
  saveWorkspace(ws);
  return project;
}

export function removeProject(projectPath: string): boolean {
  const ws = loadWorkspace();
  const absPath = path.resolve(projectPath);
  const before = ws.projects.length;
  ws.projects = ws.projects.filter(p => path.resolve(p.path) !== absPath);
  if (ws.projects.length === before) return false;
  saveWorkspace(ws);
  return true;
}

export function findProject(nameOrPath: string): WorkspaceProject | undefined {
  const ws = loadWorkspace();
  return ws.projects.find(
    p => p.name === nameOrPath || p.path === nameOrPath || slugify(p.name) === nameOrPath
  );
}

export function ensureInWorkspace(root: string): void {
  const ws = loadWorkspace();
  const absPath = path.resolve(root);
  if (!ws.projects.find(p => path.resolve(p.path) === absPath)) {
    const name = path.basename(absPath);
    addProject(name, absPath);
  }
}
