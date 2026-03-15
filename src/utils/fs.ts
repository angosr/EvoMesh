import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

export function writeYaml(filePath: string, data: unknown): void {
  writeFile(filePath, YAML.stringify(data));
}

export function readYaml<T>(filePath: string): T {
  return YAML.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

export function exists(p: string): boolean {
  return fs.existsSync(p);
}

export function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}
