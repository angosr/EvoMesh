import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findProjectRoot,
  evomeshDir,
  rolesDir,
  roleDir,
  runtimeDir,
  sharedDir,
  expandHome,
} from "../../src/utils/paths.js";

describe("path helpers", () => {
  const root = "/fake/project";

  it("evomeshDir appends .evomesh", () => {
    assert.equal(evomeshDir(root), "/fake/project/.evomesh");
  });

  it("rolesDir appends .evomesh/roles", () => {
    assert.equal(rolesDir(root), "/fake/project/.evomesh/roles");
  });

  it("roleDir appends .evomesh/roles/<name>", () => {
    assert.equal(roleDir(root, "executor"), "/fake/project/.evomesh/roles/executor");
  });

  it("runtimeDir appends .evomesh/runtime", () => {
    assert.equal(runtimeDir(root), "/fake/project/.evomesh/runtime");
  });

  it("sharedDir appends .evomesh/shared", () => {
    assert.equal(sharedDir(root), "/fake/project/.evomesh/shared");
  });
});

describe("expandHome", () => {
  it("expands ~/path using HOME env", () => {
    const origHome = process.env.HOME;
    process.env.HOME = "/users/test";
    try {
      assert.equal(expandHome("~/foo/bar"), "/users/test/foo/bar");
    } finally {
      process.env.HOME = origHome;
    }
  });

  it("leaves absolute paths unchanged", () => {
    assert.equal(expandHome("/abs/path"), "/abs/path");
  });

  it("leaves relative paths unchanged", () => {
    assert.equal(expandHome("relative/path"), "relative/path");
  });

  it("handles ~ without slash (no expansion)", () => {
    assert.equal(expandHome("~nope"), "~nope");
  });
});

describe("findProjectRoot", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "evomesh-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("returns root when .evomesh/project.yaml exists", () => {
    const evomesh = path.join(tmpDir, ".evomesh");
    fs.mkdirSync(evomesh);
    fs.writeFileSync(path.join(evomesh, "project.yaml"), "name: test\n");
    assert.equal(findProjectRoot(tmpDir), tmpDir);
  });

  it("returns root when searching from a subdirectory", () => {
    const evomesh = path.join(tmpDir, ".evomesh");
    fs.mkdirSync(evomesh);
    fs.writeFileSync(path.join(evomesh, "project.yaml"), "name: test\n");
    const sub = path.join(tmpDir, "a", "b", "c");
    fs.mkdirSync(sub, { recursive: true });
    assert.equal(findProjectRoot(sub), tmpDir);
  });

  it("returns null when no project root found", () => {
    assert.equal(findProjectRoot(tmpDir), null);
  });
});
