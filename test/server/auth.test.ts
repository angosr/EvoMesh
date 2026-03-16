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

  it("addUser creates a new user with 'user' role", () => {
    auth.addUser("user1", "userpass", "user");
    const users = auth.listUsers();
    assert.equal(users.length, 2);
    const v = users.find(u => u.username === "user1");
    assert.ok(v);
    assert.equal(v.role, "user");
  });

  it("addUser throws for duplicate username", () => {
    assert.throws(() => auth.addUser("user1", "x", "user"), /already exists/i);
  });

  it("verifyUser works for added user", () => {
    const user = auth.verifyUser("user1", "userpass");
    assert.ok(user);
    assert.equal(user.role, "user");
  });

  it("resetPassword changes password without knowing old one", () => {
    auth.resetPassword("user1", "resetpass");
    assert.equal(auth.verifyUser("user1", "userpass"), null);
    assert.ok(auth.verifyUser("user1", "resetpass"));
  });

  it("resetPassword throws for nonexistent user", () => {
    assert.throws(() => auth.resetPassword("nobody", "x"), /not found/i);
  });

  it("deleteUser removes user", () => {
    auth.deleteUser("user1");
    assert.equal(auth.verifyUser("user1", "resetpass"), null);
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

  it("loadUsers auto-migrates viewer role to user", async () => {
    // Write a users.yaml with legacy "viewer" role
    const YAML = await import("yaml");
    const config = {
      users: [
        { username: "oldviewer", passwordHash: "abc", salt: "def", role: "viewer", createdAt: "2026-01-01" },
        { username: "keepadmin", passwordHash: "ghi", salt: "jkl", role: "admin", createdAt: "2026-01-01" },
      ],
    };
    fs.mkdirSync(usersDir, { recursive: true });
    fs.writeFileSync(usersFile, YAML.stringify(config), "utf-8");

    // listUsers triggers loadUsers which auto-migrates
    const users = auth.listUsers();
    const viewer = users.find(u => u.username === "oldviewer");
    assert.ok(viewer);
    assert.equal(viewer.role, "user");
    const admin = users.find(u => u.username === "keepadmin");
    assert.ok(admin);
    assert.equal(admin.role, "admin");

    // Verify file was rewritten
    const raw = YAML.parse(fs.readFileSync(usersFile, "utf-8"));
    assert.equal(raw.users.find((u: any) => u.username === "oldviewer").role, "user");
  });
});
