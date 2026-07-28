import test from "node:test";
import assert from "node:assert/strict";
import { resolveGarmentManifest } from "./garment-resolver.ts";

test("Norwegian clothing prompts resolve the requested three-dimensional garment", () => {
  assert.equal(resolveGarmentManifest("lag en hvit hettegenser", "00000000-0000-4000-8000-000000000001").top?.category, "hoodie");
  assert.equal(resolveGarmentManifest("rosa prinsessekjole", "00000000-0000-4000-8000-000000000002").onePiece?.category, "dress");
});
