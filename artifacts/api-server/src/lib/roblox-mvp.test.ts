import test from "node:test";
import assert from "node:assert/strict";
import { buildRobloxAuthorizeUrl, createPkcePair } from "../services/roblox/roblox-oauth.service.ts";
import { uploadClassicClothingToRoblox } from "../services/roblox/roblox-upload.service.ts";

test("createPkcePair generates oauth state and code challenge", () => {
  const pair = createPkcePair();
  assert.ok(pair.state.length > 10);
  assert.ok(pair.verifier.length > 10);
  assert.ok(pair.challenge.length > 10);
});

test("buildRobloxAuthorizeUrl includes required oauth params", () => {
  const authorizeUrl = buildRobloxAuthorizeUrl(
    {
      clientId: "client-id",
      clientSecret: "secret",
      redirectUri: "https://my-skins.app/api/roblox/callback",
      authorizeUrl: "https://apis.roblox.com/oauth/v1/authorize",
      tokenUrl: "https://apis.roblox.com/oauth/v1/token",
    },
    "state-1",
    "challenge-1",
  );

  const parsed = new URL(authorizeUrl);
  assert.equal(parsed.searchParams.get("client_id"), "client-id");
  assert.equal(parsed.searchParams.get("state"), "state-1");
  assert.equal(parsed.searchParams.get("code_challenge"), "challenge-1");
});

test("uploadClassicClothingToRoblox returns mock asset when endpoint seam is not configured", async () => {
  delete process.env.ROBLOX_CLASSIC_UPLOAD_URL;
  const result = await uploadClassicClothingToRoblox({
    accessToken: "token",
    title: "MVP Shirt",
    itemType: "shirt",
    pngUrl: "https://cdn.example.com/export.png",
  });

  assert.ok(result.assetId.startsWith("mock-shirt-"));
  assert.equal(result.moderationStatus, "pending_review");
});
