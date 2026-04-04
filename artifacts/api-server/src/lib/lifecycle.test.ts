import test from "node:test";
import assert from "node:assert/strict";
import { deriveRobloxUploadTerminalState, resolveCreatorIdentity, resolveExportDimensions, resolveRobloxUploadBlockedReason, toExportJobResponse } from "./lifecycle";

test("resolveExportDimensions returns canonical classic template dimensions", () => {
  assert.deepEqual(resolveExportDimensions("shirt"), { width: 585, height: 559 });
  assert.deepEqual(resolveExportDimensions("pants"), { width: 585, height: 559 });
});

test("deriveRobloxUploadTerminalState uses explicit non-simulated statuses", () => {
  assert.deepEqual(deriveRobloxUploadTerminalState("not_configured").status, "failed");
  assert.deepEqual(deriveRobloxUploadTerminalState("missing_connection").status, "failed");
  assert.deepEqual(deriveRobloxUploadTerminalState("activation_pending").status, "blocked");
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

test("resolveRobloxUploadBlockedReason handles not configured, not connected, activation pending", () => {
  assert.equal(resolveRobloxUploadBlockedReason({
    configured: false,
    hasConnectionToken: false,
    activationReady: true,
  }), "not_configured");

  assert.equal(resolveRobloxUploadBlockedReason({
    configured: true,
    hasConnectionToken: false,
    activationReady: true,
  }), "missing_connection");

  assert.equal(resolveRobloxUploadBlockedReason({
    configured: true,
    hasConnectionToken: true,
    activationReady: true,
  }), "activation_pending");
});
