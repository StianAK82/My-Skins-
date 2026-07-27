import test from "node:test";
import assert from "node:assert/strict";
import { HOODIE_VISIBILITY_THRESHOLDS, WHITE_HOODIE_BASELINE, inspectHoodieProjection } from "./preview-quality.ts";

test("white hoodie controlled projection clears every visibility threshold", () => {
  assert.equal(WHITE_HOODIE_BASELINE.passed, true);
  for (const [key, threshold] of Object.entries(HOODIE_VISIBILITY_THRESHOLDS)) assert.ok(WHITE_HOODIE_BASELINE[key as keyof typeof HOODIE_VISIBILITY_THRESHOLDS] >= threshold);
});

test("enhanced preview fails when required construction is missing", () => {
  assert.equal(inspectHoodieProjection({ ...WHITE_HOODIE_BASELINE, drawstrings: 0, pocket: .1 }).passed, false);
});
