import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import YAML from "yaml";
import type { UserRole } from "./auth.js";

const ACL_FILE = path.join(os.homedir(), ".evomesh", "acl.yaml");

export type ProjectRole = "owner" | "member" | "viewer";

interface ProjectMember {
  username: string;
  role: "member" | "viewer";
}

interface ProjectAcl {
  owner: string;
  members: ProjectMember[];
}

interface AclConfig {
  projects: Record<string, ProjectAcl>;
}

const PROJECT_ROLE_HIERARCHY: Record<ProjectRole, number> = {
  owner: 3,
  member: 2,
  viewer: 1,
};

// --- Storage ---

export function loadAcl(): AclConfig {
  try {
    if (fs.existsSync(ACL_FILE)) {
      const raw = YAML.parse(fs.readFileSync(ACL_FILE, "utf-8"));
      if (raw?.projects && typeof raw.projects === "object") return raw as AclConfig;
    }
  } catch {}
  return { projects: {} };
}

export function saveAcl(config: AclConfig): void {
  fs.mkdirSync(path.dirname(ACL_FILE), { recursive: true });
  fs.writeFileSync(ACL_FILE, YAML.stringify(config), "utf-8");
}

// --- Query ---

/**
 * Compute the effective project role for a user.
 * Admin system role implicitly grants "owner" on all projects.
 * Returns null if the user has no access to the project.
 */
export function getProjectRole(
  username: string,
  systemRole: UserRole,
  projectPath: string,
): ProjectRole | null {
  if (systemRole === "admin") return "owner";

  const acl = loadAcl();
  const key = path.resolve(projectPath);
  const project = acl.projects[key];
  if (!project) return null;

  if (project.owner === username) return "owner";

  const member = project.members.find(m => m.username === username);
  if (member) return member.role;

  return null;
}

/**
 * Check if a user meets the minimum required project role.
 */
export function hasMinProjectRole(
  username: string,
  systemRole: UserRole,
  projectPath: string,
  minRole: ProjectRole,
): boolean {
  const role = getProjectRole(username, systemRole, projectPath);
  if (!role) return false;
  return PROJECT_ROLE_HIERARCHY[role] >= PROJECT_ROLE_HIERARCHY[minRole];
}

// --- Mutations ---

export function setProjectOwner(projectPath: string, username: string): void {
  const acl = loadAcl();
  const key = path.resolve(projectPath);
  if (!acl.projects[key]) {
    acl.projects[key] = { owner: username, members: [] };
  } else {
    acl.projects[key].owner = username;
  }
  saveAcl(acl);
}

export function grantAccess(
  projectPath: string,
  targetUser: string,
  role: "member" | "viewer",
): void {
  const acl = loadAcl();
  const key = path.resolve(projectPath);
  if (!acl.projects[key]) {
    acl.projects[key] = { owner: "", members: [] };
  }
  const project = acl.projects[key];
  if (project.owner === targetUser) {
    throw new Error(`"${targetUser}" is the project owner`);
  }
  const existing = project.members.find(m => m.username === targetUser);
  if (existing) {
    existing.role = role;
  } else {
    project.members.push({ username: targetUser, role });
  }
  saveAcl(acl);
}

export function revokeAccess(projectPath: string, targetUser: string): void {
  const acl = loadAcl();
  const key = path.resolve(projectPath);
  const project = acl.projects[key];
  if (!project) return;
  if (project.owner === targetUser) {
    throw new Error("Cannot revoke owner access");
  }
  project.members = project.members.filter(m => m.username !== targetUser);
  saveAcl(acl);
}

export function listMembers(
  projectPath: string,
): { owner: string; members: ProjectMember[] } | null {
  const acl = loadAcl();
  const key = path.resolve(projectPath);
  const project = acl.projects[key];
  if (!project) return null;
  return { owner: project.owner, members: [...project.members] };
}

export function removeProject(projectPath: string): void {
  const acl = loadAcl();
  const key = path.resolve(projectPath);
  delete acl.projects[key];
  saveAcl(acl);
}

/**
 * Get all project paths a user has access to.
 * Admin sees all projects (handled externally — this returns ACL-granted ones).
 */
export function getAccessibleProjects(username: string): string[] {
  const acl = loadAcl();
  const result: string[] = [];
  for (const [projectPath, project] of Object.entries(acl.projects)) {
    if (project.owner === username || project.members.some(m => m.username === username)) {
      result.push(projectPath);
    }
  }
  return result;
}
