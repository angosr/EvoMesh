import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  writePid,
  readPid,
  removePid,
  listRunning,
} from "../../src/process/registry.js";

describe("process/registry", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "evomesh-reg-"));
    // Create the runtime dir structure that the module expects
    fs.mkdirSync(path.join(tmpDir, ".evomesh", "runtime"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("writePid creates a pid file", () => {
    writePid(tmpDir, "executor", 12345);
    const pidPath = path.join(tmpDir, ".evomesh", "runtime", "executor.pid");
    assert.ok(fs.existsSync(pidPath));
    assert.equal(fs.readFileSync(pidPath, "utf-8"), "12345");
  });

  it("readPid returns info for existing pid file", () => {
    writePid(tmpDir, "test-role", process.pid); // use our own pid — guaranteed alive
    const info = readPid(tmpDir, "test-role");
    assert.ok(info);
    assert.equal(info.role, "test-role");
    assert.equal(info.pid, process.pid);
    assert.equal(info.alive, true);
  });

  it("readPid returns null for missing pid file", () => {
    assert.equal(readPid(tmpDir, "nonexistent"), null);
  });

  it("readPid reports dead process", () => {
    // PID 2147483647 is almost certainly not running
    writePid(tmpDir, "dead", 2147483647);
    const info = readPid(tmpDir, "dead");
    assert.ok(info);
    assert.equal(info.alive, false);
  });

  it("readPid returns null for invalid pid content", () => {
    const pidPath = path.join(tmpDir, ".evomesh", "runtime", "bad.pid");
    fs.writeFileSync(pidPath, "not-a-number", "utf-8");
    assert.equal(readPid(tmpDir, "bad"), null);
  });

  it("removePid deletes the pid file", () => {
    writePid(tmpDir, "remove-me", 99999);
    removePid(tmpDir, "remove-me");
    const pidPath = path.join(tmpDir, ".evomesh", "runtime", "remove-me.pid");
    assert.ok(!fs.existsSync(pidPath));
  });

  it("removePid is no-op for nonexistent file", () => {
    assert.doesNotThrow(() => removePid(tmpDir, "nope"));
  });

  it("listRunning returns running processes", () => {
    writePid(tmpDir, "alive", process.pid);
    writePid(tmpDir, "dead", 2147483647);
    const list = listRunning(tmpDir);
    assert.ok(list.length >= 1);
    const alive = list.find((p) => p.role === "alive");
    assert.ok(alive);
    assert.equal(alive.alive, true);
  });

  it("listRunning returns empty for no runtime dir", () => {
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "evomesh-empty-"));
    try {
      assert.deepEqual(listRunning(emptyRoot), []);
    } finally {
      fs.rmSync(emptyRoot, { recursive: true });
    }
  });
});
