import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ensureAccountProfile, resolveRoleAccount } from "../../src/config/accounts.js";
import type { ProjectConfig, RoleConfig } from "../../src/config/schema.js";

describe("config/accounts", () => {
  it("falls back to the provider default when a legacy account alias points to another provider", () => {
    const config: ProjectConfig = {
      name: "test-project",
      created: "2026-01-01",
      repo: "",
      lang: "zh",
      accounts: { main: "~/.claude" },
      roles: {},
      git: { branch: "main", conflict_resolution: "auto", auto_push: true },
    };
    const role: RoleConfig = {
      type: "worker",
      provider: "codex",
      account: "main",
      loop_interval: "10m",
      evolution_upgrade_every: 0,
      scope: [],
      description: "Codex role",
    };

    const resolved = resolveRoleAccount(config, role);
    assert.equal(resolved.provider, "codex");
    assert.equal(resolved.profileId, null);
    assert.equal(resolved.rawPath, "~/.codex");
    assert.equal(resolved.isDefault, true);
  });

  it("creates and reuses provider-aware account profiles", () => {
    const config: ProjectConfig = {
      name: "test-project",
      created: "2026-01-01",
      repo: "",
      lang: "zh",
      roles: {},
      git: { branch: "main", conflict_resolution: "auto", auto_push: true },
    };

    const firstId = ensureAccountProfile(config, "codex", "~/.codex-work", "work");
    const secondId = ensureAccountProfile(config, "codex", "~/.codex-work", "work");

    assert.equal(firstId, secondId);
    assert.equal(config.account_profiles?.[firstId]?.provider, "codex");
    assert.equal(config.account_profiles?.[firstId]?.path, "~/.codex-work");
  });
});
