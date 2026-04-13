import type { AvatarCosmeticSlot, DesignLayer, TemplateType } from "./design-state.ts";

export type AssetCategory = "pattern" | "graphic" | "trim" | "patch" | "accessory" | "module" | "hair";
export type AvatarAssetCategory = "face" | "hair" | "hat" | "neck" | "shoulder" | "back" | "footwear" | "aura";

export type StudioAsset = {
  id: string;
  name: string;
  category: AssetCategory;
  defaultColor: string;
  supportedTemplates: TemplateType[];
  preferredZone: string;
  overlayImage?: string;
};

export type AvatarMeshType =
  | "box"
  | "face_decal"
  | "hair_layered"
  | "hair_bob"
  | "hair_twintail"
  | "hat_cap"
  | "hat_beanie"
  | "hat_horns"
  | "neck_chain"
  | "neck_scarf"
  | "shoulder_pet"
  | "shoulder_armor"
  | "back_pack"
  | "back_sword"
  | "footwear_sneaker"
  | "footwear_boot"
  | "aura_ring"
  | "aura_flame"
  | "aura_pixels";

export type AvatarAsset = {
  id: string;
  name: string;
  category: AvatarAssetCategory;
  slot: AvatarCosmeticSlot;
  color: string;
  mesh: AvatarMeshType;
};

const svgData = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const OVERLAY_IMAGES = {
  pattern_houndstooth: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#e2e8f0"/><path d="M0 0h24v24H0zM24 24h24v24H24z" fill="#1e293b"/><path d="M10 16h8v16h-8zM30 32h8v16h-8z" fill="#0f172a"/></svg>'),
  graphic_dragon: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="192" height="128" viewBox="0 0 192 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fb923c"/><stop offset="1" stop-color="#ea580c"/></linearGradient></defs><path d="M20 92c44-4 44-60 84-64 24-2 40 10 52 24-24-4-30 10-34 20 8-2 16-2 24 0-18 12-42 14-66 18-16 4-36 14-60 2z" fill="url(#g)"/><circle cx="118" cy="54" r="5" fill="#0f172a"/></svg>'),
  graphic_skull: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140"><g fill="#e2e8f0" stroke="#0f172a" stroke-width="6"><circle cx="70" cy="52" r="36"/><rect x="44" y="76" width="52" height="36" rx="10"/></g><circle cx="56" cy="52" r="8" fill="#0f172a"/><circle cx="84" cy="52" r="8" fill="#0f172a"/><rect x="62" y="86" width="16" height="14" fill="#0f172a"/></svg>'),
  trim_neon: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="192" height="48" viewBox="0 0 192 48"><rect width="192" height="48" rx="20" fill="#22d3ee"/><rect x="8" y="14" width="176" height="20" rx="10" fill="#67e8f9"/></svg>'),
  trim_gold: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="192" height="48" viewBox="0 0 192 48"><rect width="192" height="48" rx="20" fill="#f59e0b"/><rect x="8" y="14" width="176" height="20" rx="10" fill="#fcd34d"/></svg>'),
  patch_team: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect x="10" y="10" width="100" height="100" rx="20" fill="#3b82f6" stroke="#1d4ed8" stroke-width="8"/><path d="M60 28l10 22 24 2-18 16 6 24-22-12-22 12 6-24-18-16 24-2z" fill="#dbeafe"/></svg>'),
  accessory_chain: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><g fill="none" stroke="#fde047" stroke-width="12"><circle cx="60" cy="76" r="24"/><circle cx="98" cy="84" r="24"/></g></svg>'),
  module_side_stripe: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="196" viewBox="0 0 72 196"><rect width="72" height="196" fill="#a855f7"/><rect x="28" width="16" height="196" fill="#e9d5ff"/></svg>'),
  module_pocket: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><path d="M18 18h84v72c0 12-10 22-22 22H40c-12 0-22-10-22-22z" fill="#334155" stroke="#94a3b8" stroke-width="6"/></svg>'),
  hair_preview_spiky: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><path d="M20 92c4-30 20-42 36-54l8 18 14-26 16 22 18-16 14 34 14-8 0 50z" fill="#4b2e1f"/></svg>'),
} as const;

export const STUDIO_ASSETS: StudioAsset[] = [
  { id: "pattern_houndstooth", name: "Houndstooth Pattern", category: "pattern", defaultColor: "#cbd5e1", supportedTemplates: ["shirt", "pants"], preferredZone: "front", overlayImage: OVERLAY_IMAGES.pattern_houndstooth },
  { id: "graphic_dragon", name: "Dragon Graphic", category: "graphic", defaultColor: "#f97316", supportedTemplates: ["shirt"], preferredZone: "front", overlayImage: OVERLAY_IMAGES.graphic_dragon },
  { id: "graphic_skull", name: "Skull Symbol", category: "graphic", defaultColor: "#e2e8f0", supportedTemplates: ["shirt", "pants"], preferredZone: "front", overlayImage: OVERLAY_IMAGES.graphic_skull },
  { id: "trim_neon", name: "Neon Trim", category: "trim", defaultColor: "#22d3ee", supportedTemplates: ["shirt", "pants"], preferredZone: "left_sleeve", overlayImage: OVERLAY_IMAGES.trim_neon },
  { id: "trim_gold", name: "Gold Trim", category: "trim", defaultColor: "#f59e0b", supportedTemplates: ["shirt", "pants"], preferredZone: "right_sleeve", overlayImage: OVERLAY_IMAGES.trim_gold },
  { id: "patch_team", name: "Team Patch", category: "patch", defaultColor: "#3b82f6", supportedTemplates: ["shirt"], preferredZone: "back", overlayImage: OVERLAY_IMAGES.patch_team },
  { id: "accessory_chain", name: "Chain Accessory", category: "accessory", defaultColor: "#fde047", supportedTemplates: ["shirt"], preferredZone: "front", overlayImage: OVERLAY_IMAGES.accessory_chain },
  { id: "module_side_stripe", name: "Side Stripe Module", category: "module", defaultColor: "#a855f7", supportedTemplates: ["pants"], preferredZone: "left_leg_front", overlayImage: OVERLAY_IMAGES.module_side_stripe },
  { id: "module_pocket", name: "Pocket Module", category: "module", defaultColor: "#334155", supportedTemplates: ["pants"], preferredZone: "right_leg_front", overlayImage: OVERLAY_IMAGES.module_pocket },
  { id: "hair_preview_spiky", name: "Spiky Hair Preview", category: "hair", defaultColor: "#4b2e1f", supportedTemplates: ["shirt", "pants"], preferredZone: "front", overlayImage: OVERLAY_IMAGES.hair_preview_spiky },
];

export const AVATAR_ASSETS: AvatarAsset[] = [
  { id: "face_confident", name: "Confident Face", category: "face", slot: "face", color: "#111827", mesh: "face_decal" },
  { id: "face_smiley", name: "Smiley Face", category: "face", slot: "face", color: "#1f2937", mesh: "face_decal" },
  { id: "face_stoic", name: "Stoic Face", category: "face", slot: "face", color: "#0f172a", mesh: "face_decal" },
  { id: "face_anime_glint", name: "Anime Glint Face", category: "face", slot: "face", color: "#111827", mesh: "face_decal" },

  { id: "hair_spiky_ember", name: "Spiky Ember Hair", category: "hair", slot: "hair", color: "#3b2a1d", mesh: "hair_layered" },
  { id: "hair_wavy_midnight", name: "Wavy Midnight Hair", category: "hair", slot: "hair", color: "#111827", mesh: "hair_bob" },
  { id: "hair_twin_tail_pop", name: "Twin Tail Pop", category: "hair", slot: "hair", color: "#1f2937", mesh: "hair_twintail" },

  { id: "hat_street_cap", name: "Street Cap", category: "hat", slot: "hat", color: "#0f172a", mesh: "hat_cap" },
  { id: "hat_beanie_soft", name: "Soft Beanie", category: "hat", slot: "hat", color: "#334155", mesh: "hat_beanie" },
  { id: "hat_cyber_horns", name: "Cyber Horns", category: "hat", slot: "hat", color: "#38bdf8", mesh: "hat_horns" },

  { id: "neck_chain_gold", name: "Gold Chain", category: "neck", slot: "neck", color: "#facc15", mesh: "neck_chain" },
  { id: "neck_scarf_neo", name: "Neo Scarf", category: "neck", slot: "neck", color: "#22c55e", mesh: "neck_scarf" },

  { id: "shoulder_orb_left", name: "Left Shoulder Pet", category: "shoulder", slot: "leftShoulder", color: "#60a5fa", mesh: "shoulder_pet" },
  { id: "shoulder_orb_right", name: "Right Shoulder Pet", category: "shoulder", slot: "rightShoulder", color: "#60a5fa", mesh: "shoulder_pet" },
  { id: "shoulder_guard_left", name: "Left Shoulder Guard", category: "shoulder", slot: "leftShoulder", color: "#94a3b8", mesh: "shoulder_armor" },
  { id: "shoulder_guard_right", name: "Right Shoulder Guard", category: "shoulder", slot: "rightShoulder", color: "#94a3b8", mesh: "shoulder_armor" },

  { id: "back_jetpack_mini", name: "Mini Jetpack", category: "back", slot: "back", color: "#334155", mesh: "back_pack" },
  { id: "back_blade_rig", name: "Blade Rig", category: "back", slot: "back", color: "#64748b", mesh: "back_sword" },

  { id: "footwear_runner_black", name: "Runner Black", category: "footwear", slot: "leftFootwear", color: "#111111", mesh: "footwear_sneaker" },
  { id: "footwear_runner_black_right", name: "Runner Black (Right)", category: "footwear", slot: "rightFootwear", color: "#111111", mesh: "footwear_sneaker" },
  { id: "footwear_tech_boot_l", name: "Tech Boot (Left)", category: "footwear", slot: "leftFootwear", color: "#1e293b", mesh: "footwear_boot" },
  { id: "footwear_tech_boot_r", name: "Tech Boot (Right)", category: "footwear", slot: "rightFootwear", color: "#1e293b", mesh: "footwear_boot" },

  { id: "aura_neon_ring", name: "Neon Aura", category: "aura", slot: "aura", color: "#22d3ee", mesh: "aura_ring" },
  { id: "aura_flame_orbit", name: "Flame Orbit", category: "aura", slot: "aura", color: "#f97316", mesh: "aura_flame" },
  { id: "aura_pixel_spark", name: "Pixel Spark", category: "aura", slot: "aura", color: "#a855f7", mesh: "aura_pixels" },
];

const STUDIO_ASSET_MAP = new Map(STUDIO_ASSETS.map((asset) => [asset.id, asset] as const));
const AVATAR_ASSET_MAP = new Map(AVATAR_ASSETS.map((asset) => [asset.id, asset] as const));

export function getAssetsForTemplate(template: TemplateType) {
  return STUDIO_ASSETS.filter((asset) => asset.supportedTemplates.includes(template));
}

export function getAssetById(assetId?: string) {
  return assetId ? STUDIO_ASSET_MAP.get(assetId) : undefined;
}

export function getAvatarAssets() {
  return AVATAR_ASSETS;
}

export function getAvatarAssetById(assetId?: string) {
  return assetId ? AVATAR_ASSET_MAP.get(assetId) : undefined;
}

export function getAvatarAssetsForSlot(slot: AvatarCosmeticSlot) {
  return AVATAR_ASSETS.filter((asset) => asset.slot === slot);
}

export function getLayerOverlayImage(layer: Pick<DesignLayer, "assetId" | "image">) {
  if (layer.image) return layer.image;
  return getAssetById(layer.assetId)?.overlayImage;
}

export function makeLayerFromAsset(asset: StudioAsset, activeZone: string): Omit<DesignLayer, "id" | "transform"> & { transform: Partial<DesignLayer["transform"]> } {
  return {
    name: asset.name,
    type: asset.category === "accessory" || asset.category === "hair" ? "accessoryLayer" : "moduleLayer",
    zone: activeZone || asset.preferredZone,
    assetId: asset.id,
    assetCategory: asset.category,
    color: asset.defaultColor,
    image: asset.overlayImage,
    transform: {
      x: 0,
      y: 0,
      scale: asset.category === "trim" ? 1.2 : 1,
      rotation: 0,
      opacity: 0.95,
    },
  };
}
