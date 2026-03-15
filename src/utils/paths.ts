import path from "node:path";
import fs from "node:fs";

export function findProjectRoot(from: string = process.cwd()): string | null {
  let dir = path.resolve(from);
  while (true) {
    if (fs.existsSync(path.join(dir, ".evomesh", "project.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function requireProjectRoot(): string {
  const root = findProjectRoot();
  if (!root) {
    console.error(
      "Not inside an EvoMesh project. Run `evomesh init` first."
    );
    process.exit(1);
  }
  return root;
}

export function evomeshDir(root: string): string {
  return path.join(root, ".evomesh");
}

export function rolesDir(root: string): string {
  return path.join(root, ".evomesh", "roles");
}

export function roleDir(root: string, name: string): string {
  return path.join(root, ".evomesh", "roles", name);
}

export function runtimeDir(root: string): string {
  return path.join(root, ".evomesh", "runtime");
}

export function sharedDir(root: string): string {
  return path.join(root, ".evomesh", "shared");
}

export function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(process.env.HOME || "/home", p.slice(2));
  }
  return p;
}
