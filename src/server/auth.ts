import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import YAML from "yaml";

const AUTH_DIR = path.join(os.homedir(), ".evomesh");
const AUTH_FILE = path.join(AUTH_DIR, "auth.yaml");

interface AuthConfig {
  passwordHash: string;
  salt: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

export function loadAuth(): AuthConfig | null {
  try {
    if (!fs.existsSync(AUTH_FILE)) return null;
    const raw = YAML.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    if (!raw?.passwordHash || !raw?.salt) return null;
    return raw as AuthConfig;
  } catch {
    return null;
  }
}

export function isPasswordSet(): boolean {
  return loadAuth() !== null;
}

export function setPassword(password: string): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const salt = crypto.randomBytes(32).toString("hex");
  const passwordHash = hashPassword(password, salt);
  fs.writeFileSync(AUTH_FILE, YAML.stringify({ passwordHash, salt }), "utf-8");
}

export function verifyPassword(password: string): boolean {
  const auth = loadAuth();
  if (!auth) return false;
  return hashPassword(password, auth.salt) === auth.passwordHash;
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
