import assert from "node:assert/strict";
import test from "node:test";
import { CLASSIC_REGIONS, CLASSIC_TEXTURE_SIZE, encodeRgba, resizeToAtlas } from "../services/ai/classic-atlas.ts";

test("classic texture finalization emits the exact Roblox atlas dimensions", () => {
  const source = encodeRgba(2, 2, Buffer.from([
    255, 0, 0, 255, 0, 255, 0, 128,
    0, 0, 255, 64, 255, 255, 255, 0,
  ]));
  const finalized = resizeToAtlas(source);

  assert.deepEqual(finalized.subarray(0, 8), Buffer.from("89504e470d0a1a0a", "hex"));
  assert.equal(finalized.readUInt32BE(16), CLASSIC_TEXTURE_SIZE.width);
  assert.equal(finalized.readUInt32BE(20), CLASSIC_TEXTURE_SIZE.height);
  assert.equal(finalized[25], 6, "finalized PNG must retain an alpha channel");
});

test("each garment validates every physical rectangle exactly once", () => {
  for (const regions of Object.values(CLASSIC_REGIONS)) {
    const rectangles = regions.map(({ x, y, width, height }) => `${x}:${y}:${width}:${height}`);
    assert.equal(new Set(rectangles).size, rectangles.length);
  }
});

test("canonical shirt map contains every torso and arm face inside 585x559", () => {
  const expected = ["torso_front", "torso_back", "torso_left", "torso_right", "torso_top", "torso_bottom"];
  for (const limb of ["left_arm", "right_arm"])
    for (const face of ["front", "back", "left", "right", "top", "bottom"])
      expected.push(`${limb}_${face}`);
  assert.deepEqual(new Set(CLASSIC_REGIONS.shirt.map((zone) => zone.name)), new Set(expected));
  for (const zone of CLASSIC_REGIONS.shirt) {
    assert.ok(zone.x >= 0 && zone.y >= 0 && zone.width > 0 && zone.height > 0);
    assert.ok(zone.x + zone.width <= CLASSIC_TEXTURE_SIZE.width);
    assert.ok(zone.y + zone.height <= CLASSIC_TEXTURE_SIZE.height);
  }
});
