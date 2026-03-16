import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolate: set HOME to temp dir before import
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "evomesh-acl-"));
const originalHome = process.env.HOME;
process.env.HOME = tmpHome;

const acl = await import("../../src/server/acl.js");

const PROJECT_A = path.join(tmpHome, "projects", "alpha");
const PROJECT_B = path.join(tmpHome, "projects", "beta");

describe("server/acl", () => {
  const aclFile = path.join(tmpHome, ".evomesh", "acl.yaml");

  before(() => {
    fs.mkdirSync(path.join(tmpHome, "projects"), { recursive: true });
  });

  beforeEach(() => {
    if (fs.existsSync(aclFile)) fs.unlinkSync(aclFile);
  });

  after(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  // --- loadAcl / saveAcl ---

  it("loadAcl returns empty when no file exists", () => {
    const config = acl.loadAcl();
    assert.deepEqual(config, { projects: {} });
  });

  it("saveAcl creates file and loadAcl reads it back", () => {
    acl.saveAcl({ projects: { [PROJECT_A]: { owner: "alice", members: [] } } });
    assert.ok(fs.existsSync(aclFile));
    const config = acl.loadAcl();
    assert.equal(config.projects[PROJECT_A].owner, "alice");
  });

  // --- setProjectOwner ---

  it("setProjectOwner creates new project entry", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    const config = acl.loadAcl();
    assert.equal(config.projects[PROJECT_A].owner, "alice");
    assert.deepEqual(config.projects[PROJECT_A].members, []);
  });

  it("setProjectOwner updates existing owner", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    acl.setProjectOwner(PROJECT_A, "bob");
    const config = acl.loadAcl();
    assert.equal(config.projects[PROJECT_A].owner, "bob");
  });

  // --- getProjectRole ---

  it("admin always gets owner role", () => {
    const role = acl.getProjectRole("admin", "admin", PROJECT_A);
    assert.equal(role, "owner");
  });

  it("project owner gets owner role", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    const role = acl.getProjectRole("alice", "user", PROJECT_A);
    assert.equal(role, "owner");
  });

  it("member gets their assigned role", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    acl.grantAccess(PROJECT_A, "bob", "member");
    assert.equal(acl.getProjectRole("bob", "user", PROJECT_A), "member");
  });

  it("viewer gets viewer role", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    acl.grantAccess(PROJECT_A, "charlie", "viewer");
    assert.equal(acl.getProjectRole("charlie", "user", PROJECT_A), "viewer");
  });

  it("unknown user gets null", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    assert.equal(acl.getProjectRole("stranger", "user", PROJECT_A), null);
  });

  it("user with no ACL entry gets null", () => {
    assert.equal(acl.getProjectRole("anyone", "user", "/nonexistent"), null);
  });

  // --- hasMinProjectRole ---

  it("owner meets member requirement", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    assert.equal(acl.hasMinProjectRole("alice", "user", PROJECT_A, "member"), true);
  });

  it("member does not meet owner requirement", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    acl.grantAccess(PROJECT_A, "bob", "member");
    assert.equal(acl.hasMinProjectRole("bob", "user", PROJECT_A, "owner"), false);
  });

  it("viewer meets viewer requirement", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    acl.grantAccess(PROJECT_A, "charlie", "viewer");
    assert.equal(acl.hasMinProjectRole("charlie", "user", PROJECT_A, "viewer"), true);
  });

  // --- grantAccess ---

  it("grantAccess adds a member", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    acl.grantAccess(PROJECT_A, "bob", "member");
    const members = acl.listMembers(PROJECT_A);
    assert.ok(members);
    assert.equal(members.members.length, 1);
    assert.equal(members.members[0].username, "bob");
    assert.equal(members.members[0].role, "member");
  });

  it("grantAccess updates existing member role", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    acl.grantAccess(PROJECT_A, "bob", "viewer");
    acl.grantAccess(PROJECT_A, "bob", "member");
    const members = acl.listMembers(PROJECT_A);
    assert.ok(members);
    assert.equal(members.members.length, 1);
    assert.equal(members.members[0].role, "member");
  });

  it("grantAccess throws for owner", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    assert.throws(() => acl.grantAccess(PROJECT_A, "alice", "member"), /owner/i);
  });

  // --- revokeAccess ---

  it("revokeAccess removes member", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    acl.grantAccess(PROJECT_A, "bob", "member");
    acl.revokeAccess(PROJECT_A, "bob");
    assert.equal(acl.getProjectRole("bob", "user", PROJECT_A), null);
  });

  it("revokeAccess throws for owner", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    assert.throws(() => acl.revokeAccess(PROJECT_A, "alice"), /owner/i);
  });

  it("revokeAccess is no-op for nonexistent project", () => {
    acl.revokeAccess("/nonexistent", "bob"); // should not throw
  });

  // --- listMembers ---

  it("listMembers returns null for unknown project", () => {
    assert.equal(acl.listMembers("/nonexistent"), null);
  });

  it("listMembers returns owner and members", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    acl.grantAccess(PROJECT_A, "bob", "member");
    acl.grantAccess(PROJECT_A, "charlie", "viewer");
    const result = acl.listMembers(PROJECT_A);
    assert.ok(result);
    assert.equal(result.owner, "alice");
    assert.equal(result.members.length, 2);
  });

  // --- removeProject ---

  it("removeProject deletes ACL entry", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    acl.removeProject(PROJECT_A);
    assert.equal(acl.listMembers(PROJECT_A), null);
  });

  // --- getAccessibleProjects ---

  it("getAccessibleProjects returns owned and member projects", () => {
    acl.setProjectOwner(PROJECT_A, "alice");
    acl.setProjectOwner(PROJECT_B, "bob");
    acl.grantAccess(PROJECT_B, "alice", "member");
    const projects = acl.getAccessibleProjects("alice");
    assert.equal(projects.length, 2);
    assert.ok(projects.includes(PROJECT_A));
    assert.ok(projects.includes(PROJECT_B));
  });

  it("getAccessibleProjects returns empty for unknown user", () => {
    assert.deepEqual(acl.getAccessibleProjects("nobody"), []);
  });
});
