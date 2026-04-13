import test from "node:test";
import assert from "node:assert/strict";
import { buildAiAvatarLook } from "./avatar-look.ts";

test("AI avatar look mapping creates distinct anime/cyber/flame combinations", () => {
  const anime = buildAiAvatarLook("Anime", ["#a855f7", "#111827"]);
  assert.equal(anime.slots?.face?.assetId, "face_anime_glint");
  assert.equal(anime.slots?.hair?.assetId, "hair_twin_tail_pop");

  const cyber = buildAiAvatarLook("Cyber tactical", ["#22d3ee", "#334155"]);
  assert.equal(cyber.slots?.hat?.assetId, "hat_cyber_horns");
  assert.equal(cyber.slots?.leftFootwear?.assetId, "footwear_tech_boot_l");

  const flame = buildAiAvatarLook("Flame streetwear", ["#fb923c", "#0f172a"]);
  assert.equal(flame.slots?.aura?.assetId, "aura_flame_orbit");
  assert.equal(flame.slots?.back?.assetId, "back_blade_rig");
});
