import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

// Isolate auth module: set HOME to temp dir before import
// so auth.ts reads/writes users.yaml in the temp dir instead of real ~/.evomesh/
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "evomesh-auth-"));
const originalHome = process.env.HOME;
process.env.HOME = tmpHome;

// Dynamic import after HOME override (module-level constants use os.homedir())
const auth = await import("../../src/server/auth.js");

describe("server/auth", () => {
  const usersDir = path.join(tmpHome, ".evomesh");
  const usersFile = path.join(usersDir, "users.yaml");

  before(() => {
    // Ensure clean state
    if (fs.existsSync(usersFile)) fs.unlinkSync(usersFile);
  });

  after(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it("hasAnyUser returns false when no users", () => {
    assert.equal(auth.hasAnyUser(), false);
  });

  it("setupAdmin creates first admin user", () => {
    auth.setupAdmin("admin", "pass1234");
    assert.equal(auth.hasAnyUser(), true);
    const users = auth.listUsers();
    assert.equal(users.length, 1);
    assert.equal(users[0].username, "admin");
    assert.equal(users[0].role, "admin");
  });

  it("setupAdmin throws if users already exist", () => {
    assert.throws(() => auth.setupAdmin("admin2", "pass"), /already exist/i);
  });

  it("verifyUser succeeds with correct password", () => {
    const user = auth.verifyUser("admin", "pass1234");
    assert.ok(user);
    assert.equal(user.username, "admin");
    assert.equal(user.role, "admin");
  });

  it("verifyUser returns null for wrong password", () => {
    assert.equal(auth.verifyUser("admin", "wrongpass"), null);
  });

  it("verifyUser returns null for nonexistent user", () => {
    assert.equal(auth.verifyUser("nobody", "pass"), null);
  });

  it("changePassword succeeds with correct old password", () => {
    const ok = auth.changePassword("admin", "pass1234", "newpass");
    assert.equal(ok, true);
    // Old password no longer works
    assert.equal(auth.verifyUser("admin", "pass1234"), null);
    // New password works
    assert.ok(auth.verifyUser("admin", "newpass"));
  });

  it("changePassword fails with wrong old password", () => {
    assert.equal(auth.changePassword("admin", "wrongold", "x"), false);
  });

  it("addUser creates a new user", () => {
    auth.addUser("viewer1", "viewpass", "viewer");
    const users = auth.listUsers();
    assert.equal(users.length, 2);
    const v = users.find(u => u.username === "viewer1");
    assert.ok(v);
    assert.equal(v.role, "viewer");
  });

  it("addUser throws for duplicate username", () => {
    assert.throws(() => auth.addUser("viewer1", "x", "viewer"), /already exists/i);
  });

  it("verifyUser works for added user", () => {
    const user = auth.verifyUser("viewer1", "viewpass");
    assert.ok(user);
    assert.equal(user.role, "viewer");
  });

  it("resetPassword changes password without knowing old one", () => {
    auth.resetPassword("viewer1", "resetpass");
    assert.equal(auth.verifyUser("viewer1", "viewpass"), null);
    assert.ok(auth.verifyUser("viewer1", "resetpass"));
  });

  it("resetPassword throws for nonexistent user", () => {
    assert.throws(() => auth.resetPassword("nobody", "x"), /not found/i);
  });

  it("deleteUser removes user", () => {
    auth.deleteUser("viewer1");
    assert.equal(auth.verifyUser("viewer1", "resetpass"), null);
    assert.equal(auth.listUsers().length, 1);
  });

  it("deleteUser throws for nonexistent user", () => {
    assert.throws(() => auth.deleteUser("nobody"), /not found/i);
  });

  it("generateSessionToken returns unique tokens", () => {
    const t1 = auth.generateSessionToken();
    const t2 = auth.generateSessionToken();
    assert.ok(t1.length > 20);
    assert.notEqual(t1, t2);
  });

  it("listUsers does not expose password hash or salt", () => {
    const users = auth.listUsers();
    for (const u of users) {
      assert.equal("passwordHash" in u, false);
      assert.equal("salt" in u, false);
    }
  });

  it("migrateIfNeeded migrates legacy auth.yaml", () => {
    // Clean current users
    if (fs.existsSync(usersFile)) fs.unlinkSync(usersFile);

    // Create legacy auth.yaml with known hash
    const legacyFile = path.join(usersDir, "auth.yaml");
    const salt = crypto.randomBytes(32).toString("hex");
    const hash = crypto.pbkdf2Sync("legacypass", salt, 100000, 64, "sha512").toString("hex");
    fs.writeFileSync(legacyFile, `passwordHash: "${hash}"\nsalt: "${salt}"\n`, "utf-8");

    auth.migrateIfNeeded();

    // Should have migrated
    assert.equal(auth.hasAnyUser(), true);
    const user = auth.verifyUser("admin", "legacypass");
    assert.ok(user);
    assert.equal(user.role, "admin");

    // Legacy file should be renamed
    assert.equal(fs.existsSync(legacyFile), false);
    assert.equal(fs.existsSync(legacyFile + ".bak"), true);
  });
});
