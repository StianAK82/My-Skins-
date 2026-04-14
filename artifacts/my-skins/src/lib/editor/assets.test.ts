import test from "node:test";
import assert from "node:assert/strict";
import { getAvatarAssetById, getAvatarAssetsForSlot, getAvatarBaseModel } from "./assets.ts";

test("avatar assets resolve upgraded cosmetic meshes by id", () => {
  assert.equal(getAvatarAssetById("hair_spiky_ember")?.renderMode, "part_kit");
  assert.equal(getAvatarAssetById("face_confident")?.renderMode, "decal");
  assert.equal(getAvatarAssetById("face_confident")?.decalTexture?.startsWith("data:image/svg+xml"), true);
  assert.equal(getAvatarAssetById("aura_neon_ring")?.parts?.length ? true : false, true);
});

test("slot lookups remain deterministic for asymmetric slots", () => {
  const left = getAvatarAssetsForSlot("leftFootwear").map((asset) => asset.id);
  const right = getAvatarAssetsForSlot("rightFootwear").map((asset) => asset.id);
  assert.deepEqual(left, ["footwear_runner_black", "footwear_tech_boot_l"]);
  assert.deepEqual(right, ["footwear_runner_black_right", "footwear_tech_boot_r"]);
});

test("base avatar models expose asset-driven body definitions", () => {
  const heroic = getAvatarBaseModel("heroic");
  assert.equal(heroic.modelPath.endsWith(".glb"), true);
  assert.equal(heroic.bodyParts.length >= 8, true);
});
