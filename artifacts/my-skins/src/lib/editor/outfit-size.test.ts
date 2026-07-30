import assert from "node:assert/strict";
import test from "node:test";
import { accessoryPreviewScale } from "./outfit";

test("accessory sizes map to stable semantic preview scales", () => {
  assert.equal(accessoryPreviewScale("small"), 0.75);
  assert.equal(accessoryPreviewScale("medium"), 1);
  assert.equal(accessoryPreviewScale("large"), 1.35);
});

test("missing legacy accessory size remains medium-compatible", () => {
  assert.equal(accessoryPreviewScale(undefined), 1);
});
