import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCLIArgs } from "../src/provider.js";

describe("provider/buildCLIArgs", () => {
  it("adds the required Codex host parameters", () => {
    const args = buildCLIArgs("codex", { model: "gpt-5.4", roleName: "codex-dev" });
    assert.deepEqual(args, [
      "--model", "gpt-5.4",
      "--ask-for-approval", "never",
      "--sandbox", "danger-full-access",
      "--config", 'model_reasoning_effort="high"',
    ]);
  });

  it("keeps Claude startup arguments unchanged", () => {
    const args = buildCLIArgs("claude", { roleName: "lead" });
    assert.deepEqual(args, ["--name", "lead", "--dangerously-skip-permissions"]);
  });
});
