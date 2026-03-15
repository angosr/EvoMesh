import fs from "node:fs";
import path from "node:path";
import { runtimeDir } from "../utils/paths.js";
import { ensureDir, exists } from "../utils/fs.js";

export interface ProcessInfo {
  role: string;
  pid: number;
  alive: boolean;
}

function pidFile(root: string, role: string): string {
  return path.join(runtimeDir(root), `${role}.pid`);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function writePid(root: string, role: string, pid: number): void {
  ensureDir(runtimeDir(root));
  fs.writeFileSync(pidFile(root, role), String(pid), "utf-8");
}

export function readPid(root: string, role: string): ProcessInfo | null {
  const f = pidFile(root, role);
  if (!exists(f)) return null;
  const pid = parseInt(fs.readFileSync(f, "utf-8").trim(), 10);
  if (isNaN(pid)) return null;
  return { role, pid, alive: isAlive(pid) };
}

export function removePid(root: string, role: string): void {
  const f = pidFile(root, role);
  if (exists(f)) fs.unlinkSync(f);
}

export function listRunning(root: string): ProcessInfo[] {
  const dir = runtimeDir(root);
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".pid"))
    .map((f) => {
      const role = f.replace(".pid", "");
      return readPid(root, role);
    })
    .filter((info): info is ProcessInfo => info !== null);
}
