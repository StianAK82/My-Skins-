import type { AvatarStatePatch } from "./design-state.ts";

function zeroTransform() {
  return { scale: 1, offset: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, visible: true };
}

export function buildAiAvatarLook(style: string, palette: string[]): AvatarStatePatch {
  const lower = style.toLowerCase();
  const dark = lower.includes("dark") || lower.includes("goth");
  const anime = lower.includes("anime");
  const cyber = lower.includes("cyber") || lower.includes("tech");
  const street = lower.includes("street") || lower.includes("sport");
  const flame = lower.includes("flame") || lower.includes("fire");

  const auraAssetId = flame ? "aura_flame_orbit" : cyber ? "aura_pixel_spark" : street ? "aura_neon_ring" : null;
  const hairAssetId = anime ? "hair_twin_tail_pop" : dark ? "hair_wavy_midnight" : "hair_spiky_ember";
  const faceAssetId = anime ? "face_anime_glint" : dark ? "face_stoic" : "face_confident";

  return {
    modelVariant: cyber ? "heroic" : street ? "proportioned_r15" : "classic_blocky",
    presentation: anime || street ? "androgynous" : "neutral",
    skinTone: "#f1c27d",
    pose: street ? "walk" : cyber ? "hero" : "idle",
    scalePreset: cyber ? "stocky" : anime ? "slender" : "standard",
    bodyScale: {
      height: anime ? 1.08 : 1,
      width: dark ? 0.98 : cyber ? 1.1 : 1,
      head: anime ? 1.08 : 1,
      legs: street ? 1.1 : 1,
    },
    slots: {
      face: { assetId: faceAssetId, color: "#0f172a", ...zeroTransform() },
      hair: { assetId: hairAssetId, color: palette[1] ?? "#111827", ...zeroTransform(), offset: { x: 0, y: 0.05, z: 0 } },
      hat: cyber ? { assetId: "hat_cyber_horns", color: palette[0] ?? "#38bdf8", ...zeroTransform() } : street ? { assetId: "hat_street_cap", color: palette[0] ?? "#0f172a", ...zeroTransform() } : dark ? { assetId: "hat_beanie_soft", color: "#1e293b", ...zeroTransform() } : null,
      neck: cyber ? { assetId: "neck_scarf_neo", color: palette[0] ?? "#22c55e", ...zeroTransform() } : { assetId: "neck_chain_gold", color: palette[0] ?? "#facc15", ...zeroTransform() },
      leftShoulder: cyber ? { assetId: "shoulder_guard_left", color: "#94a3b8", ...zeroTransform(), scale: 0.95 } : dark ? { assetId: "shoulder_orb_left", color: "#60a5fa", ...zeroTransform(), scale: 0.85 } : null,
      rightShoulder: cyber ? { assetId: "shoulder_guard_right", color: "#94a3b8", ...zeroTransform(), scale: 0.95 } : dark ? { assetId: "shoulder_orb_right", color: "#60a5fa", ...zeroTransform(), scale: 0.85 } : null,
      back: cyber ? { assetId: "back_jetpack_mini", color: "#334155", ...zeroTransform() } : flame ? { assetId: "back_blade_rig", color: "#475569", ...zeroTransform() } : null,
      leftFootwear: { assetId: cyber ? "footwear_tech_boot_l" : "footwear_runner_black", ...zeroTransform() },
      rightFootwear: { assetId: cyber ? "footwear_tech_boot_r" : "footwear_runner_black_right", ...zeroTransform() },
      aura: auraAssetId ? { assetId: auraAssetId, color: palette[0] ?? "#22d3ee", ...zeroTransform() } : null,
    },
  };
}
