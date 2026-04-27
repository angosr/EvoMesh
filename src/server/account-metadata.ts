import fs from "node:fs";
import path from "node:path";
import type { ProviderName } from "../provider.js";

export interface AccountMetadata {
  email: string | null;
  subscriptionType: string | null;
  rateLimitTier: string | null;
  tokenExpiresAt: number | null;
}

function readJson(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return null;
    return JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

export function readAccountMetadata(dir: string, providerName: ProviderName): AccountMetadata {
  if (providerName === "claude") {
    const claudeJson = readJson(path.join(dir, ".claude.json"));
    const credentials = readJson(path.join(dir, ".credentials.json"));
    const oauth = credentials?.claudeAiOauth || {};

    return {
      email: claudeJson?.email || claudeJson?.oauthAccount?.emailAddress || null,
      subscriptionType: claudeJson?.subscriptionType || oauth.subscriptionType || null,
      rateLimitTier: oauth.rateLimitTier || null,
      tokenExpiresAt: oauth.expiresAt || null,
    };
  }

  const auth = readJson(path.join(dir, "auth.json"));
  const payload = auth?.tokens?.id_token ? decodeJwtPayload(auth.tokens.id_token) : null;
  const authInfo = payload?.["https://api.openai.com/auth"] || {};

  return {
    email: payload?.email || null,
    subscriptionType: authInfo.chatgpt_plan_type || (auth?.OPENAI_API_KEY ? "api-key" : null),
    rateLimitTier: null,
    tokenExpiresAt: typeof payload?.exp === "number" ? payload.exp * 1000 : null,
  };
}
