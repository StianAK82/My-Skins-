import { createHash, randomBytes } from "node:crypto";

export type RobloxOauthConfig = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authorizeUrl: string;
  tokenUrl: string;
};

export type RobloxTokenExchangeResult = {
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string | null;
  scope: string | null;
  expiresInSeconds: number | null;
  robloxUserId: string;
  robloxUsername: string;
};

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

export function createPkcePair() {
  const state = base64url(randomBytes(24));
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { state, verifier, challenge };
}

export function buildRobloxAuthorizeUrl(config: RobloxOauthConfig, state: string, challenge: string) {
  if (!config.clientId || !config.redirectUri) {
    throw new Error("ROBLOX_NOT_CONFIGURED");
  }
  const authUrl = new URL(config.authorizeUrl);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("scope", "openid profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  return authUrl.toString();
}

export async function exchangeRobloxOAuthCode(input: {
  config: RobloxOauthConfig;
  code: string;
  verifier: string;
}): Promise<RobloxTokenExchangeResult> {
  const { config, code, verifier } = input;
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error("ROBLOX_NOT_CONFIGURED");
  }

  const tokenResponse = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("TOKEN_EXCHANGE_FAILED");
  }

  const tokenData = await tokenResponse.json() as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
    user_id?: string;
    preferred_username?: string;
  };

  return {
    accessToken: tokenData.access_token ?? null,
    refreshToken: tokenData.refresh_token ?? null,
    tokenType: tokenData.token_type ?? null,
    scope: tokenData.scope ?? null,
    expiresInSeconds: tokenData.expires_in ?? null,
    robloxUserId: tokenData.user_id ?? "unknown",
    robloxUsername: tokenData.preferred_username ?? "roblox-user",
  };
}
