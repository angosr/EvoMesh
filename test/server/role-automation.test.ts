import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { clearRoleAutomation, configureRoleAutomation } from "../../src/server/role-automation.js";
import type { RoleConfig } from "../../src/config/schema.js";

describe("server/role-automation", () => {
  afterEach(() => {
    clearRoleAutomation("demo/worker");
  });

  it("starts the repeating interval only after the initial send fires", () => {
    const originalSetTimeout = global.setTimeout;
    const originalSetInterval = global.setInterval;
    const originalClearTimeout = global.clearTimeout;
    const originalClearInterval = global.clearInterval;
    const originalConsoleError = console.error;

    let timeoutCallback: (() => void) | null = null;
    let intervalCalls = 0;

    global.setTimeout = ((fn: (...args: any[]) => void) => {
      timeoutCallback = () => fn();
      return { kind: "timeout" } as any;
    }) as typeof global.setTimeout;
    global.setInterval = ((fn: (...args: any[]) => void) => {
      intervalCalls++;
      return { kind: "interval", fn } as any;
    }) as typeof global.setInterval;
    global.clearTimeout = (() => {}) as typeof global.clearTimeout;
    global.clearInterval = (() => {}) as typeof global.clearInterval;
    console.error = () => {};

    try {
      const roleConfig: RoleConfig = {
        type: "worker",
        provider: "codex",
        automation_mode: "prompt",
        automation_prompt: "Continue the task.",
        loop_interval: "30s",
        evolution_upgrade_every: 0,
        scope: [],
        description: "Codex role",
      };

      configureRoleAutomation("/tmp/project", "demo", "worker", roleConfig);
      assert.equal(intervalCalls, 0);
      assert.ok(timeoutCallback);

      timeoutCallback?.();
      assert.equal(intervalCalls, 1);
    } finally {
      global.setTimeout = originalSetTimeout;
      global.setInterval = originalSetInterval;
      global.clearTimeout = originalClearTimeout;
      global.clearInterval = originalClearInterval;
      console.error = originalConsoleError;
    }
  });
});
