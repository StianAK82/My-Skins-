import type { DesignLayer, TemplateType } from "./design-state.ts";

export type AssetCategory = "pattern" | "graphic" | "trim" | "patch" | "accessory" | "module" | "hair";

export type StudioAsset = {
  id: string;
  name: string;
  category: AssetCategory;
  defaultColor: string;
  supportedTemplates: TemplateType[];
  preferredZone: string;
};

export const STUDIO_ASSETS: StudioAsset[] = [
  { id: "pattern_houndstooth", name: "Houndstooth Pattern", category: "pattern", defaultColor: "#cbd5e1", supportedTemplates: ["shirt", "pants"], preferredZone: "front" },
  { id: "graphic_dragon", name: "Dragon Graphic", category: "graphic", defaultColor: "#f97316", supportedTemplates: ["shirt"], preferredZone: "front" },
  { id: "graphic_skull", name: "Skull Symbol", category: "graphic", defaultColor: "#e2e8f0", supportedTemplates: ["shirt", "pants"], preferredZone: "front" },
  { id: "trim_neon", name: "Neon Trim", category: "trim", defaultColor: "#22d3ee", supportedTemplates: ["shirt", "pants"], preferredZone: "left_sleeve" },
  { id: "trim_gold", name: "Gold Trim", category: "trim", defaultColor: "#f59e0b", supportedTemplates: ["shirt", "pants"], preferredZone: "right_sleeve" },
  { id: "patch_team", name: "Team Patch", category: "patch", defaultColor: "#3b82f6", supportedTemplates: ["shirt"], preferredZone: "back" },
  { id: "accessory_chain", name: "Chain Accessory", category: "accessory", defaultColor: "#fde047", supportedTemplates: ["shirt"], preferredZone: "front" },
  { id: "module_side_stripe", name: "Side Stripe Module", category: "module", defaultColor: "#a855f7", supportedTemplates: ["pants"], preferredZone: "left_leg_front" },
  { id: "module_pocket", name: "Pocket Module", category: "module", defaultColor: "#334155", supportedTemplates: ["pants"], preferredZone: "right_leg_front" },
  { id: "hair_preview_spiky", name: "Spiky Hair Preview", category: "hair", defaultColor: "#4b2e1f", supportedTemplates: ["shirt", "pants"], preferredZone: "front" },
];

export function getAssetsForTemplate(template: TemplateType) {
  return STUDIO_ASSETS.filter((asset) => asset.supportedTemplates.includes(template));
}

export function makeLayerFromAsset(asset: StudioAsset, activeZone: string): Omit<DesignLayer, "id" | "transform"> & { transform: Partial<DesignLayer["transform"]> } {
  return {
    name: asset.name,
    type: asset.category === "accessory" || asset.category === "hair" ? "accessoryLayer" : "moduleLayer",
    zone: activeZone || asset.preferredZone,
    assetId: asset.id,
    assetCategory: asset.category,
    color: asset.defaultColor,
    transform: {
      x: 0,
      y: 0,
      scale: asset.category === "trim" ? 1.2 : 1,
      rotation: 0,
      opacity: 0.95,
    },
  };
}
