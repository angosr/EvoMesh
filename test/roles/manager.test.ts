import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { createRole, deleteRole, listRoles } from "../../src/roles/manager.js";
import type { ProjectConfig } from "../../src/config/schema.js";

describe("roles/manager", () => {
  let tmpDir: string;
  let config: ProjectConfig;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "evomesh-mgr-"));
    fs.mkdirSync(path.join(tmpDir, ".evomesh", "roles"), { recursive: true });

    config = {
      name: "test-project",
      created: "2026-01-01",
      repo: "https://github.com/test/test",
      accounts: { main: "~/.claude" },
      roles: {},
      git: {
        branch: "main",
        conflict_resolution: "auto",
        auto_push: true,
      },
    };
    // Write initial project.yaml
    fs.writeFileSync(
      path.join(tmpDir, ".evomesh", "project.yaml"),
      YAML.stringify(config),
      "utf-8"
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("createRole creates directory structure", () => {
    createRole(tmpDir, "worker1", "executor", config, "main");
    const roleDir = path.join(tmpDir, ".evomesh", "roles", "worker1");
    assert.ok(fs.existsSync(roleDir));
    assert.ok(fs.existsSync(path.join(roleDir, "ROLE.md")));
    assert.ok(fs.existsSync(path.join(roleDir, "todo.md")));
    assert.ok(fs.existsSync(path.join(roleDir, "archive.md")));
    assert.ok(fs.existsSync(path.join(roleDir, "inbox", "processed")));
    assert.ok(fs.existsSync(path.join(roleDir, "memory", "short-term.md")));
    assert.ok(fs.existsSync(path.join(roleDir, "memory", "long-term.md")));
  });

  it("createRole updates project.yaml", () => {
    createRole(tmpDir, "worker1", "executor", config, "main");
    const updated = YAML.parse(
      fs.readFileSync(path.join(tmpDir, ".evomesh", "project.yaml"), "utf-8")
    );
    assert.ok(updated.roles.worker1);
    assert.equal(updated.roles.worker1.account, "main");
  });

  it("listRoles returns created roles", () => {
    createRole(tmpDir, "alpha", "executor", config, "main");
    createRole(tmpDir, "beta", "executor", config, "main");
    const roles = listRoles(tmpDir);
    assert.ok(roles.includes("alpha"));
    assert.ok(roles.includes("beta"));
  });

  it("listRoles returns empty for no roles", () => {
    assert.deepEqual(listRoles(tmpDir), []);
  });

  it("deleteRole removes directory and config entry", () => {
    createRole(tmpDir, "to-delete", "executor", config, "main");
    assert.ok(config.roles["to-delete"]);
    deleteRole(tmpDir, "to-delete", config);
    assert.ok(!fs.existsSync(path.join(tmpDir, ".evomesh", "roles", "to-delete")));
    const updated = YAML.parse(
      fs.readFileSync(path.join(tmpDir, ".evomesh", "project.yaml"), "utf-8")
    );
    assert.ok(!updated.roles["to-delete"]);
  });
});
