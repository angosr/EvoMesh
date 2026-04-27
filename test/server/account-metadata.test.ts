import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readAccountMetadata } from "../../src/server/account-metadata.js";

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function createJwt(payload: Record<string, unknown>): string {
  const header = encodeBase64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = encodeBase64Url(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe("server/account-metadata", () => {
  it("reads Claude account email and subscription metadata", () => {
    const dir = createTempDir("evomesh-acct-claude-");
    try {
      fs.writeFileSync(path.join(dir, ".claude.json"), JSON.stringify({
        email: "claude@example.com",
        subscriptionType: "pro",
      }));
      fs.writeFileSync(path.join(dir, ".credentials.json"), JSON.stringify({
        claudeAiOauth: {
          rateLimitTier: "default_claude_pro",
          expiresAt: 1760000000000,
        },
      }));

      const metadata = readAccountMetadata(dir, "claude");
      assert.equal(metadata.email, "claude@example.com");
      assert.equal(metadata.subscriptionType, "pro");
      assert.equal(metadata.rateLimitTier, "default_claude_pro");
      assert.equal(metadata.tokenExpiresAt, 1760000000000);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads Codex account email and token expiry from JWT", () => {
    const dir = createTempDir("evomesh-acct-codex-");
    try {
      const idToken = createJwt({
        email: "codex@example.com",
        exp: 1760000000,
        "https://api.openai.com/auth": {
          chatgpt_plan_type: "plus",
        },
      });
      fs.writeFileSync(path.join(dir, "auth.json"), JSON.stringify({
        tokens: { id_token: idToken },
      }));

      const metadata = readAccountMetadata(dir, "codex");
      assert.equal(metadata.email, "codex@example.com");
      assert.equal(metadata.subscriptionType, "plus");
      assert.equal(metadata.rateLimitTier, null);
      assert.equal(metadata.tokenExpiresAt, 1760000000000);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
