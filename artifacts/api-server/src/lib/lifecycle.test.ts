import test from "node:test";
import assert from "node:assert/strict";
import { deriveRobloxUploadTerminalState, resolveCreatorIdentity, resolveExportDimensions } from "./lifecycle";

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
