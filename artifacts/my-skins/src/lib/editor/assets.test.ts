import test from "node:test";
import assert from "node:assert/strict";
import { getAvatarAssetById, getAvatarAssetsForSlot } from "./assets.ts";

test("avatar assets resolve upgraded cosmetic meshes by id", () => {
  assert.equal(getAvatarAssetById("hair_spiky_ember")?.mesh, "hair_layered");
  assert.equal(getAvatarAssetById("face_confident")?.mesh, "face_decal");
  assert.equal(getAvatarAssetById("aura_neon_ring")?.mesh, "aura_ring");
});

test("slot lookups remain deterministic for asymmetric slots", () => {
  const left = getAvatarAssetsForSlot("leftFootwear").map((asset) => asset.id);
  const right = getAvatarAssetsForSlot("rightFootwear").map((asset) => asset.id);
  assert.deepEqual(left, ["footwear_runner_black", "footwear_tech_boot_l"]);
  assert.deepEqual(right, ["footwear_runner_black_right", "footwear_tech_boot_r"]);
});
