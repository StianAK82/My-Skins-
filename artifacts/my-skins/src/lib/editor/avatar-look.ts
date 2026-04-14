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

type AvatarHints = {
  styleIdentity?: string;
  avatarCoordination?: {
    faceMood?: string;
    hairMood?: string;
    auraIntent?: string;
    accessoryIntent?: string[];
  };
  outfitComposition?: {
    silhouette?: string;
    vibe?: string;
  };
};

function zeroTransform() {
  return { scale: 1, offset: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, visible: true };
}

function includesAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function chooseBundle(identity: string, coordination: AvatarHints["avatarCoordination"]): AvatarBundle {
  const source = `${identity} ${coordination?.faceMood ?? ""} ${coordination?.hairMood ?? ""}`.toLowerCase();
  if (includesAny(source, ["anime", "cute", "kawaii", "pastel"])) {
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
  if (includesAny(source, ["cyber", "tech", "tactical", "hero"])) {
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
  if (includesAny(source, ["dark", "goth", "flame", "fire", "villain"])) {
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
      aura: includesAny(source, ["flame", "fire"]) ? "aura_flame_orbit" : "aura_shadow_swirl",
    };
  }
  if (includesAny(source, ["sport", "street", "luxury"])) {
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

function chooseAura(baseAura: string | null, intent?: string) {
  if (!intent || intent === "none") return null;
  if (intent === "flame") return "aura_flame_orbit";
  if (intent === "shadow") return "aura_shadow_swirl";
  if (intent === "sparkle") return "aura_neon_ring";
  return baseAura;
}

export function buildAiAvatarLook(style: string, palette: string[], hints?: AvatarHints): AvatarStatePatch {
  const lower = `${hints?.styleIdentity ?? ""} ${style}`.toLowerCase();
  const anime = includesAny(lower, ["anime", "cute", "pastel"]);
  const cyber = includesAny(lower, ["cyber", "tech", "tactical", "hero"]);
  const street = includesAny(lower, ["street", "sport", "luxury"]);
  const bundle = chooseBundle(lower, hints?.avatarCoordination);

  const accessoryIntent = new Set((hints?.avatarCoordination?.accessoryIntent ?? []).map((value) => value.toLowerCase()));
  const silhouette = hints?.outfitComposition?.silhouette ?? "balanced";
  const vibe = hints?.outfitComposition?.vibe ?? "bold";

  return {
    modelVariant: cyber || silhouette === "armored" ? "heroic" : street ? "proportioned_r15" : "classic_blocky",
    presentation: anime || street ? "androgynous" : cyber ? "masculine" : "neutral",
    skinTone: "#f1c27d",
    pose: vibe === "flashy" || street ? "walk" : cyber ? "hero" : "idle",
    scalePreset: cyber || silhouette === "armored" ? "stocky" : anime ? "slender" : "standard",
    bodyScale: {
      height: anime ? 1.08 : silhouette === "oversized" ? 1.12 : 1,
      width: cyber || silhouette === "armored" ? 1.08 : lower.includes("dark") ? 0.98 : 1,
      head: anime ? 1.08 : 1,
      legs: street ? 1.08 : 1,
    },
    slots: {
      face: { assetId: bundle.face, color: palette[3] ?? "#0f172a", ...zeroTransform() },
      hair: { assetId: bundle.hair, color: palette[1] ?? "#111827", ...zeroTransform(), offset: { x: 0, y: 0.05, z: 0 } },
      hat: bundle.hat && (accessoryIntent.size === 0 || accessoryIntent.has("hat")) ? { assetId: bundle.hat, color: palette[0] ?? "#334155", ...zeroTransform() } : null,
      neck: bundle.neck && (accessoryIntent.size === 0 || accessoryIntent.has("neck")) ? { assetId: bundle.neck, color: palette[2] ?? "#22c55e", ...zeroTransform() } : null,
      leftShoulder: bundle.leftShoulder && accessoryIntent.has("shoulders") ? { assetId: bundle.leftShoulder, color: "#94a3b8", ...zeroTransform(), scale: 0.95 } : null,
      rightShoulder: bundle.rightShoulder && accessoryIntent.has("shoulders") ? { assetId: bundle.rightShoulder, color: "#94a3b8", ...zeroTransform(), scale: 0.95 } : null,
      back: bundle.back && (accessoryIntent.has("back") || silhouette === "armored") ? { assetId: bundle.back, color: palette[0] ?? "#475569", ...zeroTransform() } : null,
      leftFootwear: { assetId: bundle.leftFootwear, color: palette[3] ?? "#111827", ...zeroTransform() },
      rightFootwear: { assetId: bundle.rightFootwear, color: palette[3] ?? "#111827", ...zeroTransform() },
      aura: chooseAura(bundle.aura, hints?.avatarCoordination?.auraIntent)
        ? { assetId: chooseAura(bundle.aura, hints?.avatarCoordination?.auraIntent) as string, color: palette[2] ?? "#22d3ee", ...zeroTransform() }
        : null,
    },
  };
}
