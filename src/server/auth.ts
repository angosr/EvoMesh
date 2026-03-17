import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { readYaml, writeYaml } from "../utils/fs.js";

const AUTH_DIR = path.join(os.homedir(), ".evomesh");
const USERS_FILE = path.join(AUTH_DIR, "users.yaml");
const LEGACY_AUTH_FILE = path.join(AUTH_DIR, "auth.yaml");

export type UserRole = "admin" | "user";

export interface User {
  username: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  createdAt: string;
  linuxUser?: string;  // OS user whose ~/.evomesh/ this user owns
}

interface UsersConfig {
  users: User[];
}

export interface SessionInfo {
  username: string;
  role: UserRole;
  linuxUser?: string;  // OS user namespace for project filtering
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function createUser(username: string, password: string, role: UserRole, linuxUser?: string): User {
  const salt = crypto.randomBytes(32).toString("hex");
  return {
    username,
    passwordHash: hashPassword(password, salt),
    salt,
    role,
    createdAt: new Date().toISOString(),
    linuxUser: linuxUser || process.env.USER || "user",
  };
}

// --- Storage ---

function loadUsers(): UsersConfig {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = readYaml<any>(USERS_FILE);
      if (raw?.users && Array.isArray(raw.users)) {
        // Migrate legacy "viewer" role to "user"
        let migrated = false;
        for (const u of raw.users) {
          if (u.role === "viewer") { u.role = "user"; migrated = true; }
        }
        if (migrated) {
          writeYaml(USERS_FILE, raw);
        }
        return raw as UsersConfig;
      }
    }
  } catch {}
  return { users: [] };
}

function saveUsers(config: UsersConfig): void {
  writeYaml(USERS_FILE, config);
}

// --- Migration from legacy auth.yaml ---

export function migrateIfNeeded(): void {
  if (fs.existsSync(USERS_FILE)) return;
  if (!fs.existsSync(LEGACY_AUTH_FILE)) return;

  try {
    const raw = readYaml<any>(LEGACY_AUTH_FILE);
    if (!raw?.passwordHash || !raw?.salt) return;

    const config: UsersConfig = {
      users: [{
        username: "admin",
        passwordHash: raw.passwordHash,
        salt: raw.salt,
        role: "admin",
        createdAt: new Date().toISOString(),
      }],
    };
    saveUsers(config);
    // Rename legacy file as backup
    fs.renameSync(LEGACY_AUTH_FILE, LEGACY_AUTH_FILE + ".bak");
  } catch {}
}

// --- Public API ---

export function hasAnyUser(): boolean {
  return loadUsers().users.length > 0;
}

export function setupAdmin(username: string, password: string): void {
  const config = loadUsers();
  if (config.users.length > 0) throw new Error("Users already exist");
  config.users.push(createUser(username, password, "admin"));
  saveUsers(config);
}

export function verifyUser(username: string, password: string): User | null {
  const config = loadUsers();
  const user = config.users.find(u => u.username === username);
  if (!user) return null;
  const hash = hashPassword(password, user.salt);
  if (!crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"))) return null;
  return user;
}

export function changePassword(username: string, oldPassword: string, newPassword: string): boolean {
  const config = loadUsers();
  const user = config.users.find(u => u.username === username);
  if (!user) return false;
  const oldHash = hashPassword(oldPassword, user.salt);
  if (!crypto.timingSafeEqual(Buffer.from(oldHash, "hex"), Buffer.from(user.passwordHash, "hex"))) return false;
  const salt = crypto.randomBytes(32).toString("hex");
  user.salt = salt;
  user.passwordHash = hashPassword(newPassword, salt);
  saveUsers(config);
  return true;
}

export function listUsers(): Array<{ username: string; role: UserRole; createdAt: string; linuxUser?: string }> {
  return loadUsers().users.map(u => ({ username: u.username, role: u.role, createdAt: u.createdAt, linuxUser: u.linuxUser }));
}

export function addUser(username: string, password: string, role: UserRole, linuxUser?: string): void {
  const config = loadUsers();
  if (config.users.find(u => u.username === username)) {
    throw new Error(`User "${username}" already exists`);
  }
  config.users.push(createUser(username, password, role, linuxUser));
  saveUsers(config);
}

export function deleteUser(username: string): void {
  const config = loadUsers();
  const idx = config.users.findIndex(u => u.username === username);
  if (idx < 0) throw new Error(`User "${username}" not found`);
  config.users.splice(idx, 1);
  saveUsers(config);
}

export function resetPassword(username: string, newPassword: string): void {
  const config = loadUsers();
  const user = config.users.find(u => u.username === username);
  if (!user) throw new Error(`User "${username}" not found`);
  const salt = crypto.randomBytes(32).toString("hex");
  user.salt = salt;
  user.passwordHash = hashPassword(newPassword, salt);
  saveUsers(config);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
