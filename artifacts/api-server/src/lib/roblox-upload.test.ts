import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionRobloxUploadStatus, isRobloxConnectionExpired, isSupportedUploadProjectType, resolveRobloxConnectionState, toRobloxItemType } from "./roblox-upload.ts";

test("supported upload project type stays limited to classic clothing", () => {
  assert.equal(isSupportedUploadProjectType("shirt"), true);
  assert.equal(isSupportedUploadProjectType("pants"), true);
  assert.equal(isSupportedUploadProjectType("hat"), false);
  assert.equal(isSupportedUploadProjectType("ugc"), false);
});

test("token expiry helper treats near-expiry token as expired", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(isRobloxConnectionExpired({ accessTokenExpiresAt: new Date("2026-01-01T00:00:01.000Z") }, now), true);
  assert.equal(isRobloxConnectionExpired({ accessTokenExpiresAt: new Date("2026-01-01T00:02:00.000Z") }, now), false);
});

test("connection state supports connected expired disconnected", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(resolveRobloxConnectionState(null, now), "disconnected");
  assert.equal(resolveRobloxConnectionState({ disconnectedAt: new Date(), accessToken: "a", refreshToken: "r", accessTokenExpiresAt: null }, now), "disconnected");
  assert.equal(resolveRobloxConnectionState({ disconnectedAt: null, accessToken: null, refreshToken: null, accessTokenExpiresAt: null }, now), "expired");
  assert.equal(resolveRobloxConnectionState({ disconnectedAt: null, accessToken: "a", refreshToken: "r", accessTokenExpiresAt: new Date("2026-01-01T00:00:03.000Z") }, now), "expired");
  assert.equal(resolveRobloxConnectionState({ disconnectedAt: null, accessToken: "a", refreshToken: "r", accessTokenExpiresAt: new Date("2026-01-01T00:02:00.000Z") }, now), "connected");
});

test("status transitions are monotonic and block invalid retries", () => {
  assert.equal(canTransitionRobloxUploadStatus("queued", "processing"), true);
  assert.equal(canTransitionRobloxUploadStatus("processing", "completed"), true);
  assert.equal(canTransitionRobloxUploadStatus("failed", "processing"), false);
  assert.equal(canTransitionRobloxUploadStatus("completed", "queued"), false);
});

test("project type maps to strict roblox item type", () => {
  assert.equal(toRobloxItemType("shirt"), "classic_shirt");
  assert.equal(toRobloxItemType("pants"), "classic_pants");
});
