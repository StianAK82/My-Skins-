import type { AvatarStatePatch } from "./design-state.ts";

type AvatarBundle = {
  face: string;
  hair: string;
  hat: string | null;
  neck: string | null;
  leftShoulder: string | null;
  rightShoulder: string | null;
  back: string | null;
  leftFootwear: string;
  rightFootwear: string;
  aura: string | null;
};

function zeroTransform() {
  return { scale: 1, offset: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, visible: true };
}

function chooseBundle(style: string): AvatarBundle {
  const lower = style.toLowerCase();
  if (lower.includes("dragon")) {
    return {
      face: "face_stoic",
      hair: "hair_wavy_midnight",
      hat: "hat_cyber_horns",
      neck: "neck_chain_gold",
      leftShoulder: "shoulder_guard_left",
      rightShoulder: "shoulder_guard_right",
      back: "back_blade_rig",
      leftFootwear: "footwear_tech_boot_l",
      rightFootwear: "footwear_tech_boot_r",
      aura: "aura_flame_orbit",
    };
  }
  if (lower.includes("angel")) {
    return {
      face: "face_anime_glint",
      hair: "hair_twin_tail_pop",
      hat: "hat_beanie_soft",
      neck: "neck_scarf_neo",
      leftShoulder: null,
      rightShoulder: null,
      back: "back_jetpack_mini",
      leftFootwear: "footwear_runner_black",
      rightFootwear: "footwear_runner_black_right",
      aura: "aura_neon_ring",
    };
  }
  if (lower.includes("anime")) {
    return {
      face: "face_anime_glint",
      hair: "hair_twin_tail_pop",
      hat: null,
      neck: "neck_scarf_neo",
      leftShoulder: null,
      rightShoulder: null,
      back: null,
      leftFootwear: "footwear_runner_black",
      rightFootwear: "footwear_runner_black_right",
      aura: "aura_neon_ring",
    };
  }
  if (lower.includes("cyber") || lower.includes("tech") || lower.includes("tactical")) {
    return {
      face: "face_stoic",
      hair: "hair_wavy_midnight",
      hat: "hat_cyber_horns",
      neck: "neck_scarf_neo",
      leftShoulder: "shoulder_guard_left",
      rightShoulder: "shoulder_guard_right",
      back: "back_jetpack_mini",
      leftFootwear: "footwear_tech_boot_l",
      rightFootwear: "footwear_tech_boot_r",
      aura: "aura_pixel_spark",
    };
  }
  if (lower.includes("dark") || lower.includes("goth") || lower.includes("flame") || lower.includes("fire")) {
    return {
      face: "face_stoic",
      hair: "hair_wavy_midnight",
      hat: "hat_beanie_soft",
      neck: "neck_chain_gold",
      leftShoulder: "shoulder_orb_left",
      rightShoulder: "shoulder_orb_right",
      back: "back_blade_rig",
      leftFootwear: "footwear_tech_boot_l",
      rightFootwear: "footwear_tech_boot_r",
      aura: lower.includes("flame") || lower.includes("fire") ? "aura_flame_orbit" : null,
    };
  }
  if (lower.includes("sport") || lower.includes("street")) {
    return {
      face: "face_confident",
      hair: "hair_spiky_ember",
      hat: "hat_street_cap",
      neck: "neck_chain_gold",
      leftShoulder: null,
      rightShoulder: null,
      back: null,
      leftFootwear: "footwear_runner_black",
      rightFootwear: "footwear_runner_black_right",
      aura: "aura_neon_ring",
    };
  }
  return {
    face: "face_wink_star",
    hair: "hair_spiky_ember",
    hat: null,
    neck: "neck_chain_gold",
    leftShoulder: null,
    rightShoulder: null,
    back: null,
    leftFootwear: "footwear_runner_black",
    rightFootwear: "footwear_runner_black_right",
    aura: null,
  };
}

export function buildAiAvatarLook(style: string, palette: string[]): AvatarStatePatch {
  const lower = style.toLowerCase();
  const anime = lower.includes("anime");
  const cyber = lower.includes("cyber") || lower.includes("tech") || lower.includes("tactical");
  const street = lower.includes("street") || lower.includes("sport");
  const bundle = chooseBundle(style);

  return {
    modelVariant: cyber ? "heroic" : street ? "proportioned_r15" : "classic_blocky",
    presentation: anime || street ? "androgynous" : cyber ? "masculine" : "neutral",
    skinTone: "#f1c27d",
    pose: street ? "walk" : cyber ? "hero" : "idle",
    scalePreset: cyber ? "stocky" : anime ? "slender" : "standard",
    bodyScale: {
      height: anime ? 1.08 : 1,
      width: cyber ? 1.08 : lower.includes("dark") ? 0.98 : 1,
      head: anime ? 1.08 : 1,
      legs: street ? 1.08 : 1,
    },
    slots: {
      face: { assetId: bundle.face, color: "#0f172a", ...zeroTransform() },
      hair: { assetId: bundle.hair, color: palette[1] ?? "#111827", ...zeroTransform(), offset: { x: 0, y: 0.05, z: 0 } },
      hat: bundle.hat ? { assetId: bundle.hat, color: palette[0] ?? "#334155", ...zeroTransform() } : null,
      neck: bundle.neck ? { assetId: bundle.neck, color: palette[0] ?? "#22c55e", ...zeroTransform() } : null,
      leftShoulder: bundle.leftShoulder ? { assetId: bundle.leftShoulder, color: "#94a3b8", ...zeroTransform(), scale: 0.95 } : null,
      rightShoulder: bundle.rightShoulder ? { assetId: bundle.rightShoulder, color: "#94a3b8", ...zeroTransform(), scale: 0.95 } : null,
      back: bundle.back ? { assetId: bundle.back, color: "#475569", ...zeroTransform() } : null,
      leftFootwear: { assetId: bundle.leftFootwear, ...zeroTransform() },
      rightFootwear: { assetId: bundle.rightFootwear, ...zeroTransform() },
      aura: bundle.aura ? { assetId: bundle.aura, color: palette[0] ?? "#22d3ee", ...zeroTransform() } : null,
    },
  };
}
