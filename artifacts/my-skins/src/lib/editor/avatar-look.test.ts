import test from "node:test";
import assert from "node:assert/strict";
import { buildAiAvatarLook } from "./avatar-look.ts";

test("AI avatar look mapping creates distinct anime/cyber/flame combinations", () => {
  const anime = buildAiAvatarLook("Anime", ["#a855f7", "#111827", "#f8fafc"], {
    styleIdentity: "anime_cute",
    avatarCoordination: { auraIntent: "sparkle", accessoryIntent: ["neck"] },
  });
  assert.equal(anime.slots?.face?.assetId, "face_anime_glint");
  assert.equal(anime.slots?.hair?.assetId, "hair_twin_tail_pop");
  assert.equal(anime.slots?.aura?.assetId, "aura_neon_ring");

  const cyber = buildAiAvatarLook("Cyber tactical", ["#22d3ee", "#334155", "#f8fafc"], {
    styleIdentity: "cyber_streetwear",
    avatarCoordination: { accessoryIntent: ["hat", "shoulders", "back"] },
    outfitComposition: { silhouette: "armored", vibe: "bold" },
  });
  assert.equal(cyber.modelVariant, "heroic");
  assert.equal(cyber.slots?.hat?.assetId, "hat_cyber_horns");
  assert.equal(cyber.slots?.leftShoulder?.assetId, "shoulder_guard_left");
  assert.equal(cyber.slots?.back?.assetId, "back_jetpack_mini");

  const flame = buildAiAvatarLook("Flame streetwear", ["#fb923c", "#0f172a", "#f8fafc"], {
    styleIdentity: "dark_flame",
    avatarCoordination: { auraIntent: "flame", accessoryIntent: ["hat", "neck"] },
  });
  assert.equal(flame.slots?.aura?.assetId, "aura_flame_orbit");
  assert.equal(flame.slots?.hat?.assetId, "hat_beanie_soft");
});
