import assert from "node:assert/strict";
import test from "node:test";
import { decodePng, encodeRgba } from "../services/ai/classic-atlas.ts";
import { enhanceGarmentPrompt } from "../services/ai/classic-prompt-enhancer.ts";
import {
  composeGarmentFingerprint,
  GARMENT_FINGERPRINTS,
  validateGarmentFingerprint,
} from "../services/ai/garment-composer.ts";

function solidAtlas() {
  const pixels = Buffer.alloc(585 * 559 * 4);
  for (let offset = 0; offset < pixels.length; offset += 4)
    pixels.set([235, 235, 235, 255], offset);
  return encodeRgba(585, 559, pixels);
}

test("hoodie fingerprint defines every invariant construction feature", () => {
  assert.deepEqual(GARMENT_FINGERPRINTS.hoodie.required, [
    "hood",
    "hood-opening",
    "drawstrings",
    "kangaroo-pocket",
    "shoulder-seams",
    "sleeve-seams",
    "rib-cuffs",
    "rib-hem",
  ]);
});

test("composer adds deterministic hoodie construction after image generation", () => {
  const spec = enhanceGarmentPrompt("shirt", "white hoodie skin");
  const source = solidAtlas();
  const result = composeGarmentFingerprint(source, spec);
  assert.equal(result.fingerprint?.key, "hoodie");
  assert.deepEqual(validateGarmentFingerprint(spec, result.fingerprint), []);
  assert.notDeepEqual(result.png, source);

  const image = decodePng(result.png);
  const pixel = (x: number, y: number) =>
    image.rgba.subarray(
      (y * image.width + x) * 4,
      (y * image.width + x) * 4 + 3,
    );
  assert.ok(pixel(218, 194)[0] < 235, "kangaroo-pocket edge is visible");
  assert.ok(pixel(247, 147)[0] < 235, "drawstring is visible");
  assert.ok(pixel(402, 100)[0] < 235, "rear hood seam is visible");
  assert.ok(pixel(80, 234)[0] < 235, "right cuff is visible");
  assert.ok(pixel(478, 404)[0] < 235, "left cuff is visible");
});

test("validator rejects a skipped required fingerprint", () => {
  const spec = enhanceGarmentPrompt("pants", "blue denim jeans");
  assert.match(validateGarmentFingerprint(spec)[0], /missing required jeans/);
});
