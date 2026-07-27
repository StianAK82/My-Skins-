import assert from "node:assert/strict";
import test from "node:test";
import { CLASSIC_SHIRT_UV } from "./classic-shirt-uv.ts";

test("labelled preview texture maps front/back and every physical face independently", () => {
  assert.deepEqual(CLASSIC_SHIRT_UV.torso_front, { left: 196, top: 118, width: 128, height: 128 });
  assert.deepEqual(CLASSIC_SHIRT_UV.torso_back, { left: 338, top: 118, width: 128, height: 128 });
  assert.equal(Object.keys(CLASSIC_SHIRT_UV).length, 18);
  assert.notDeepEqual(CLASSIC_SHIRT_UV.left_arm_front, CLASSIC_SHIRT_UV.right_arm_front);
});
