import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionRobloxUploadStatus,
  deriveRobloxUploadTerminalState,
  isRobloxUploadableProjectType,
  resolveCreatorIdentity,
  resolveExportDimensions,
  resolveRobloxUploadBlockedReason,
  toExportJobResponse,
} from "./lifecycle.ts";

test("resolveExportDimensions returns canonical classic template dimensions", () => {
  assert.deepEqual(resolveExportDimensions("shirt"), { width: 585, height: 559 });
  assert.deepEqual(resolveExportDimensions("pants"), { width: 585, height: 559 });
});

test("deriveRobloxUploadTerminalState uses explicit failure statuses", () => {
  assert.deepEqual(deriveRobloxUploadTerminalState("not_configured").status, "failed");
  assert.deepEqual(deriveRobloxUploadTerminalState("missing_connection").status, "failed");
});

test("resolveCreatorIdentity prefers profile fields then user fallback", () => {
  const profilePreferred = resolveCreatorIdentity({
    profileDisplayName: "Profile Name",
    userFirstName: "First",
    userDisplayName: "Display",
    profileUsername: "profile_user",
    userEmail: "u@example.com",
  });
  assert.equal(profilePreferred.displayName, "Profile Name");
  assert.equal(profilePreferred.username, "profile_user");

  const fallback = resolveCreatorIdentity({ userEmail: "u@example.com" });
  assert.equal(fallback.displayName, "Creator");
  assert.equal(fallback.username, "u@example.com");
});

test("toExportJobResponse returns artifact as null when missing and includes lifecycle fields", () => {
  const completed = toExportJobResponse({
    jobId: "job-1",
    projectId: "project-1",
    format: "png",
    status: "completed",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: new Date("2026-01-01T00:01:00.000Z"),
    artifactId: "artifact-1",
    artifactUrl: "https://cdn.example/export.png",
    width: 585,
    height: 559,
    size: 1200,
  });
  assert.equal(completed.artifact?.id, "artifact-1");

  const failed = toExportJobResponse({
    jobId: "job-2",
    projectId: "project-1",
    format: "png",
    status: "failed",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: new Date("2026-01-01T00:01:00.000Z"),
    artifactId: null,
    artifactUrl: null,
    width: null,
    height: null,
    size: null,
  });
  assert.equal(failed.artifact, null);
});

test("resolveRobloxUploadBlockedReason handles not configured and not connected", () => {
  assert.equal(resolveRobloxUploadBlockedReason({
    configured: false,
    hasConnectionToken: false,
  }), "not_configured");

  assert.equal(resolveRobloxUploadBlockedReason({
    configured: true,
    hasConnectionToken: false,
  }), "missing_connection");

  assert.equal(resolveRobloxUploadBlockedReason({
    configured: true,
    hasConnectionToken: true,
  }), null);
});

test("uploadable project type guard only allows classic shirt and pants", () => {
  assert.equal(isRobloxUploadableProjectType("shirt"), true);
  assert.equal(isRobloxUploadableProjectType("pants"), true);
  assert.equal(isRobloxUploadableProjectType("wings"), false);
  assert.equal(isRobloxUploadableProjectType("hat"), false);
});

test("roblox upload status transitions are monotonic and terminal-safe", () => {
  assert.equal(canTransitionRobloxUploadStatus("pending", "processing"), true);
  assert.equal(canTransitionRobloxUploadStatus("processing", "succeeded"), true);
  assert.equal(canTransitionRobloxUploadStatus("processing", "failed"), true);
  assert.equal(canTransitionRobloxUploadStatus("succeeded", "processing"), false);
  assert.equal(canTransitionRobloxUploadStatus("failed", "processing"), false);
});
