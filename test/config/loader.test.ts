import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { loadConfig } from "../../src/config/loader.js";
import type { ProjectConfig } from "../../src/config/schema.js";

describe("config/loader", () => {
  let tmpDir: string;

  const sampleConfig: ProjectConfig = {
    name: "test-project",
    created: "2026-01-01",
    repo: "https://github.com/test/test",
    accounts: { main: "~/.claude" },
    roles: {
      executor: {
        type: "worker",
        loop_interval: "10m",
        account: "main",
        evolution_upgrade_every: 20,
        scope: ["src/"],
        description: "Code executor",
      },
    },
    git: {
      branch: "main",
      conflict_resolution: "auto",
      auto_push: true,
    },
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "evomesh-cfg-"));
    const evomesh = path.join(tmpDir, ".evomesh");
    fs.mkdirSync(evomesh, { recursive: true });
    fs.writeFileSync(
      path.join(evomesh, "project.yaml"),
      YAML.stringify(sampleConfig),
      "utf-8"
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("loadConfig reads project.yaml correctly", () => {
    const config = loadConfig(tmpDir);
    assert.equal(config.name, "test-project");
    assert.equal(config.repo, "https://github.com/test/test");
    assert.ok(config.roles.executor);
    assert.equal(config.roles.executor.type, "worker");
  });

  it("loadConfig throws for missing file", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "evomesh-empty-"));
    fs.mkdirSync(path.join(emptyDir, ".evomesh"), { recursive: true });
    try {
      assert.throws(() => loadConfig(emptyDir));
    } finally {
      fs.rmSync(emptyDir, { recursive: true });
    }
  });

  it("loadConfig preserves accounts map", () => {
    const config = loadConfig(tmpDir);
    assert.equal(config.accounts.main, "~/.claude");
  });

  it("loadConfig preserves git config", () => {
    const config = loadConfig(tmpDir);
    assert.equal(config.git.branch, "main");
    assert.equal(config.git.auto_push, true);
  });
});
