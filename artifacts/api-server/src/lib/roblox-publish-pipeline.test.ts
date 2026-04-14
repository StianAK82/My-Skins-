import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProcessingAttempt,
  parseUploadExecutionMode,
  resolveLatestCanonicalExportArtifact,
  validateRetryEligibility,
} from "./roblox-publish-pipeline.ts";

test("execution mode defaults to inline and supports deferred", () => {
  assert.equal(parseUploadExecutionMode(undefined), "inline");
  assert.equal(parseUploadExecutionMode("unknown"), "inline");
  assert.equal(parseUploadExecutionMode("deferred"), "deferred");
});

test("canonical artifact resolution picks first valid canonical png candidate", () => {
  const result = resolveLatestCanonicalExportArtifact([
    {
      exportJobId: "job-1",
      exportJobCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifactId: "artifact-invalid",
      artifactUrl: "not-a-url",
      width: 585,
      height: 559,
      size: 1024,
      artifactCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      exportJobId: "job-2",
      exportJobCreatedAt: new Date("2026-01-02T00:00:00.000Z"),
      artifactId: "artifact-valid",
      artifactUrl: "https://cdn.example.com/export.png",
      width: 585,
      height: 559,
      size: 2048,
      artifactCreatedAt: new Date("2026-01-02T00:00:00.000Z"),
    },
  ]);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.artifact.artifactId, "artifact-valid");
  }
});

test("canonical artifact resolution reports missing or invalid exports", () => {
  assert.deepEqual(resolveLatestCanonicalExportArtifact([]), { ok: false, reason: "NO_EXPORTS" });
  assert.deepEqual(resolveLatestCanonicalExportArtifact([
    {
      exportJobId: "job-1",
      exportJobCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      artifactId: "artifact-invalid",
      artifactUrl: "https://cdn.example.com/export.png",
      width: 512,
      height: 512,
      size: 2048,
      artifactCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ]), { ok: false, reason: "INVALID_CANONICAL_ARTIFACT" });
});

test("retry validation enforces failed-only and retry limits", () => {
  const nonFailed = validateRetryEligibility({ status: "completed", retryCount: 0 });
  assert.equal(nonFailed.ok, false);
  if (!nonFailed.ok) assert.equal(nonFailed.error, "RETRY_NOT_ALLOWED");

  const limitReached = validateRetryEligibility({ status: "failed", retryCount: 3 });
  assert.equal(limitReached.ok, false);
  if (!limitReached.ok) assert.equal(limitReached.error, "RETRY_LIMIT_REACHED");

  assert.deepEqual(validateRetryEligibility({ status: "failed", retryCount: 2 }), { ok: true });
});

test("processing attempt is derived from retry count", () => {
  assert.equal(buildProcessingAttempt(0), 1);
  assert.equal(buildProcessingAttempt(1), 2);
  assert.equal(buildProcessingAttempt(3), 4);
});
