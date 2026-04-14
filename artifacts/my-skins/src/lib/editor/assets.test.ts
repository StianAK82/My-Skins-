import test from "node:test";
import assert from "node:assert/strict";
import { AVATAR_ASSETS, STUDIO_ASSETS, collectAssetTags, filterAvatarAssets, filterStudioAssets, getAvatarAssetById, getAvatarAssetsForSlot, getAvatarBaseModel } from "./assets.ts";

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

test("asset browser filters studio assets by role/tag/exportability", () => {
  const filtered = filterStudioAssets(STUDIO_ASSETS, {
    category: "all",
    role: "graphic",
    importance: "hero",
    styleTag: "fantasy",
    exportFilter: "exportable",
  });
  assert.deepEqual(filtered.map((asset) => asset.id), ["graphic_dragon"]);
});

test("asset browser filters avatar assets by slot and preview-only state", () => {
  const filtered = filterAvatarAssets(AVATAR_ASSETS, {
    slot: "hat",
    category: "all",
    exportFilter: "previewOnly",
    fantasyTag: "dragon",
  });
  assert.deepEqual(filtered.map((asset) => asset.id), ["hat_cyber_horns"]);
});

test("asset browser tag collection produces deterministic sorted options", () => {
  const tags = collectAssetTags([STUDIO_ASSETS[1], AVATAR_ASSETS.find((asset) => asset.id === "hat_cyber_horns")!]);
  assert.deepEqual(tags.styleTags, ["cyber", "fantasy", "tech"]);
  assert.deepEqual(tags.fantasyTags, ["demon", "dragon"]);
});
