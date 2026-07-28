import type { AvatarCosmeticSlot, DesignLayer, TemplateType } from "./design-state.ts";

export type AssetCategory = "pattern" | "graphic" | "trim" | "patch" | "accessory" | "module" | "hair";
export type AvatarAssetCategory = "face" | "hair" | "hat" | "neck" | "shoulder" | "back" | "footwear" | "aura";
export type AssetImportance = "hero" | "support" | "decorative";
export type AssetRole = "face" | "hair" | "headwear" | "neckwear" | "armor" | "wings" | "aura" | "footwear" | "companion" | "trim" | "module" | "graphic";

export type StudioAsset = {
  id: string;
  name: string;
  category: AssetCategory;
  defaultColor: string;
  supportedTemplates: TemplateType[];
  preferredZone: string;
  overlayImage?: string;
  styleTags?: string[];
  vibeTags?: string[];
  fantasyTags?: string[];
  silhouetteTags?: string[];
  paletteAffinity?: string[];
  role?: AssetRole;
  importance?: AssetImportance;
  exportable?: boolean;
  previewOnly?: boolean;
  compatibleGarments?: TemplateType[];
  compatibilityNotes?: string;
};

export type AvatarPrimitiveType = "roundedBox" | "box" | "cylinder" | "cone" | "sphere" | "torus" | "plane";

export type AvatarRenderPart = {
  primitive: AvatarPrimitiveType;
  args: number[];
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  radius?: number;
  smoothness?: number;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  transparent?: boolean;
  metalness?: number;
  roughness?: number;
  useAssetColor?: boolean;
  texture?: string;
  alphaTest?: number;
};

export type AvatarRenderMode = "decal" | "part_kit";

export type AvatarAsset = {
  id: string;
  name: string;
  category: AvatarAssetCategory;
  slot: AvatarCosmeticSlot;
  color: string;
  renderMode: AvatarRenderMode;
  modelPath?: string;
  decalTexture?: string;
  styleTags?: string[];
  vibeTags?: string[];
  fantasyTags?: string[];
  silhouetteTags?: string[];
  paletteAffinity?: string[];
  role?: AssetRole;
  importance?: AssetImportance;
  previewOnly?: boolean;
  exportable?: boolean;
  compatibilityNotes?: string;
  defaultScale?: number;
  defaultOffset?: { x: number; y: number; z: number };
  parts?: AvatarRenderPart[];
};

export type AvatarBodyPartMaterial = "skin" | "shirt" | "pants";

export type AvatarBodyPart = {
  id: string;
  primitive: "roundedBox";
  args: [number, number, number];
  position: [number, number, number];
  radius: number;
  smoothness: number;
  material: AvatarBodyPartMaterial;
};

export type AvatarBaseModel = {
  id: "classic_blocky" | "proportioned_r15" | "heroic";
  label: string;
  modelPath: string;
  proportions: { x: number; y: number; z: number };
  bodyParts: AvatarBodyPart[];
};

export type AssetBrowserExportFilter = "all" | "exportable" | "previewOnly";

type SharedAssetFilters = {
  search?: string;
  role?: AssetRole | "all";
  styleTag?: string;
  vibeTag?: string;
  fantasyTag?: string;
  importance?: AssetImportance | "all";
  exportFilter?: AssetBrowserExportFilter;
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

const FACE_DECALS = {
  face_confident: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><circle cx="86" cy="112" r="14" fill="#111827"/><circle cx="170" cy="112" r="14" fill="#111827"/><path d="M88 182c20 18 60 18 80 0" stroke="#111827" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M62 86h40M154 86h40" stroke="#334155" stroke-width="8" stroke-linecap="round"/></svg>'),
  face_smiley: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><circle cx="84" cy="114" r="13" fill="#0f172a"/><circle cx="172" cy="114" r="13" fill="#0f172a"/><path d="M76 166c22 34 82 34 104 0" stroke="#0f172a" stroke-width="12" fill="none" stroke-linecap="round"/></svg>'),
  face_stoic: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><path d="M60 108h44M152 108h44M102 182h52" stroke="#0f172a" stroke-width="11" stroke-linecap="round"/></svg>'),
  face_anime_glint: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><ellipse cx="88" cy="124" rx="28" ry="34" fill="#60a5fa"/><ellipse cx="168" cy="124" rx="28" ry="34" fill="#60a5fa"/><ellipse cx="90" cy="128" rx="14" ry="18" fill="#0f172a"/><ellipse cx="166" cy="128" rx="14" ry="18" fill="#0f172a"/><circle cx="96" cy="116" r="6" fill="#dbeafe"/><circle cx="172" cy="116" r="6" fill="#dbeafe"/><path d="M96 186c15 13 49 13 64 0" stroke="#0f172a" stroke-width="9" fill="none" stroke-linecap="round"/></svg>'),
  face_wink_star: svgData('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><path d="M64 116h48" stroke="#0f172a" stroke-width="11" stroke-linecap="round"/><circle cx="176" cy="114" r="13" fill="#0f172a"/><path d="M88 172c20 24 62 24 82 0" stroke="#0f172a" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M204 76l6 12 13 2-10 9 3 13-12-7-11 7 2-13-10-9 13-2z" fill="#facc15"/></svg>'),
} as const;

const makePart = (primitive: AvatarPrimitiveType, args: number[], options: Omit<AvatarRenderPart, "primitive" | "args"> = {}): AvatarRenderPart => ({ primitive, args, ...options });

const hairSpikyParts = [
  makePart("roundedBox", [0.68, 0.3, 0.62], { radius: 0.16, position: [0, -0.02, -0.01], useAssetColor: true }),
  makePart("cone", [0.14, 0.34, 12], { position: [-0.24, 0.18, 0.06], rotation: [0.2, 0, -0.32], useAssetColor: true }),
  makePart("cone", [0.16, 0.38, 12], { position: [0.04, 0.22, 0.07], rotation: [0.28, 0, 0], useAssetColor: true }),
  makePart("cone", [0.14, 0.3, 12], { position: [0.24, 0.16, 0.05], rotation: [0.2, 0, 0.32], useAssetColor: true }),
];

const hairBobParts = [
  makePart("roundedBox", [0.7, 0.28, 0.64], { radius: 0.16, position: [0, 0.05, 0], useAssetColor: true }),
  makePart("roundedBox", [0.2, 0.33, 0.2], { radius: 0.09, position: [-0.3, -0.1, -0.03], useAssetColor: true }),
  makePart("roundedBox", [0.2, 0.33, 0.2], { radius: 0.09, position: [0.3, -0.1, -0.03], useAssetColor: true }),
];

const hairTwinTailParts = [
  makePart("roundedBox", [0.62, 0.24, 0.56], { radius: 0.15, position: [0, 0.09, 0], useAssetColor: true }),
  makePart("cylinder", [0.07, 0.09, 0.42, 14], { position: [-0.33, -0.16, 0], rotation: [0.05, 0, 0.2], useAssetColor: true }),
  makePart("cylinder", [0.07, 0.09, 0.42, 14], { position: [0.33, -0.16, 0], rotation: [0.05, 0, -0.2], useAssetColor: true }),
];

const hairShortParts = [
  makePart("roundedBox", [0.64, 0.24, 0.58], { radius: 0.16, position: [0, 0.02, 0], useAssetColor: true }),
];

const hairLongParts = [
  makePart("roundedBox", [0.66, 0.28, 0.6], { radius: 0.16, position: [0, 0.06, 0], useAssetColor: true }),
  makePart("roundedBox", [0.5, 0.5, 0.22], { radius: 0.12, position: [0, -0.22, -0.24], useAssetColor: true }),
];

const hairPonytailParts = [
  makePart("roundedBox", [0.62, 0.26, 0.56], { radius: 0.15, position: [0, 0.06, 0], useAssetColor: true }),
  makePart("cylinder", [0.08, 0.1, 0.5, 14], { position: [0, -0.18, -0.28], rotation: [0.3, 0, 0], useAssetColor: true }),
];

const hairCurlyParts = [
  makePart("roundedBox", [0.68, 0.3, 0.62], { radius: 0.18, position: [0, 0.04, 0], useAssetColor: true }),
  makePart("sphere", [0.12, 12, 12], { position: [-0.28, -0.04, 0.08], useAssetColor: true }),
  makePart("sphere", [0.12, 12, 12], { position: [0.28, -0.04, 0.08], useAssetColor: true }),
  makePart("sphere", [0.11, 12, 12], { position: [-0.18, 0.08, 0.22], useAssetColor: true }),
  makePart("sphere", [0.11, 12, 12], { position: [0.18, 0.08, 0.22], useAssetColor: true }),
];

const hairBraidsParts = [
  makePart("roundedBox", [0.62, 0.24, 0.56], { radius: 0.15, position: [0, 0.08, 0], useAssetColor: true }),
  makePart("cylinder", [0.05, 0.06, 0.12, 10], { position: [-0.28, -0.08, 0.06], useAssetColor: true }),
  makePart("cylinder", [0.05, 0.06, 0.12, 10], { position: [-0.28, -0.18, 0.04], useAssetColor: true }),
  makePart("cylinder", [0.05, 0.06, 0.12, 10], { position: [-0.28, -0.28, 0.02], useAssetColor: true }),
  makePart("cylinder", [0.05, 0.06, 0.12, 10], { position: [0.28, -0.08, 0.06], useAssetColor: true }),
  makePart("cylinder", [0.05, 0.06, 0.12, 10], { position: [0.28, -0.18, 0.04], useAssetColor: true }),
  makePart("cylinder", [0.05, 0.06, 0.12, 10], { position: [0.28, -0.28, 0.02], useAssetColor: true }),
];

const AVATAR_BASE_MODELS: AvatarBaseModel[] = [
  {
    id: "classic_blocky",
    label: "Classic Block Rig",
    modelPath: "/avatar/base/classic-blocky.glb",
    proportions: { x: 1.04, y: 0.98, z: 1.04 },
    bodyParts: [
      { id: "head", primitive: "roundedBox", args: [0.78, 0.7, 0.66], position: [0, 2.02, 0], radius: 0.12, smoothness: 8, material: "skin" },
      { id: "neck", primitive: "roundedBox", args: [0.3, 0.1, 0.3], position: [0, 1.66, 0], radius: 0.06, smoothness: 6, material: "skin" },
      { id: "torso", primitive: "roundedBox", args: [1.0, 1.0, 0.5], position: [0, 1.12, 0], radius: 0.08, smoothness: 8, material: "shirt" },
      { id: "leftUpperArm", primitive: "roundedBox", args: [0.46, 0.92, 0.46], position: [-0.73, 1.16, 0], radius: 0.09, smoothness: 8, material: "shirt" },
      { id: "rightUpperArm", primitive: "roundedBox", args: [0.46, 0.92, 0.46], position: [0.73, 1.16, 0], radius: 0.09, smoothness: 8, material: "shirt" },
      { id: "leftHand", primitive: "roundedBox", args: [0.44, 0.18, 0.46], position: [-0.73, 0.62, 0], radius: 0.08, smoothness: 8, material: "skin" },
      { id: "rightHand", primitive: "roundedBox", args: [0.44, 0.18, 0.46], position: [0.73, 0.62, 0], radius: 0.08, smoothness: 8, material: "skin" },
      { id: "leftLeg", primitive: "roundedBox", args: [0.48, 1.06, 0.5], position: [-0.25, 0.53, 0], radius: 0.08, smoothness: 8, material: "pants" },
      { id: "rightLeg", primitive: "roundedBox", args: [0.48, 1.06, 0.5], position: [0.25, 0.53, 0], radius: 0.08, smoothness: 8, material: "pants" },
    ],
  },
  {
    id: "proportioned_r15",
    label: "Proportioned R15 Rig",
    modelPath: "/avatar/base/proportioned-r15.glb",
    proportions: { x: 1, y: 1.02, z: 1 },
    bodyParts: [
      { id: "head", primitive: "roundedBox", args: [0.63, 0.62, 0.58], position: [0, 2.02, 0], radius: 0.16, smoothness: 8, material: "skin" },
      { id: "neck", primitive: "roundedBox", args: [0.22, 0.11, 0.22], position: [0, 1.69, 0], radius: 0.05, smoothness: 6, material: "skin" },
      { id: "upperTorso", primitive: "roundedBox", args: [0.9, 0.56, 0.5], position: [0, 1.41, 0], radius: 0.14, smoothness: 8, material: "shirt" },
      { id: "lowerTorso", primitive: "roundedBox", args: [0.84, 0.38, 0.5], position: [0, 1.02, 0], radius: 0.12, smoothness: 8, material: "pants" },
      { id: "leftUpperArm", primitive: "roundedBox", args: [0.28, 0.44, 0.28], position: [-0.58, 1.42, 0], radius: 0.12, smoothness: 8, material: "shirt" },
      { id: "rightUpperArm", primitive: "roundedBox", args: [0.28, 0.44, 0.28], position: [0.58, 1.42, 0], radius: 0.12, smoothness: 8, material: "shirt" },
      { id: "leftLowerArm", primitive: "roundedBox", args: [0.24, 0.4, 0.24], position: [-0.58, 1.0, 0], radius: 0.1, smoothness: 8, material: "shirt" },
      { id: "rightLowerArm", primitive: "roundedBox", args: [0.24, 0.4, 0.24], position: [0.58, 1.0, 0], radius: 0.1, smoothness: 8, material: "shirt" },
      { id: "leftHand", primitive: "roundedBox", args: [0.24, 0.2, 0.24], position: [-0.58, 0.72, 0], radius: 0.08, smoothness: 8, material: "skin" },
      { id: "rightHand", primitive: "roundedBox", args: [0.24, 0.2, 0.24], position: [0.58, 0.72, 0], radius: 0.08, smoothness: 8, material: "skin" },
      { id: "leftUpperLeg", primitive: "roundedBox", args: [0.33, 0.5, 0.34], position: [-0.22, 0.64, 0], radius: 0.1, smoothness: 8, material: "pants" },
      { id: "rightUpperLeg", primitive: "roundedBox", args: [0.33, 0.5, 0.34], position: [0.22, 0.64, 0], radius: 0.1, smoothness: 8, material: "pants" },
      { id: "leftLowerLeg", primitive: "roundedBox", args: [0.31, 0.48, 0.32], position: [-0.22, 0.2, 0], radius: 0.1, smoothness: 8, material: "pants" },
      { id: "rightLowerLeg", primitive: "roundedBox", args: [0.31, 0.48, 0.32], position: [0.22, 0.2, 0], radius: 0.1, smoothness: 8, material: "pants" },
    ],
  },
  {
    id: "heroic",
    label: "Heroic Rig",
    modelPath: "/avatar/base/heroic-r15.glb",
    proportions: { x: 1.1, y: 0.99, z: 1.08 },
    bodyParts: [
      { id: "head", primitive: "roundedBox", args: [0.7, 0.66, 0.62], position: [0, 2.03, 0], radius: 0.16, smoothness: 8, material: "skin" },
      { id: "neck", primitive: "roundedBox", args: [0.3, 0.16, 0.28], position: [0, 1.72, 0], radius: 0.08, smoothness: 6, material: "skin" },
      { id: "torso", primitive: "roundedBox", args: [1.02, 0.84, 0.6], position: [0, 1.32, 0], radius: 0.14, smoothness: 8, material: "shirt" },
      { id: "hips", primitive: "roundedBox", args: [0.88, 0.43, 0.56], position: [0, 0.82, 0], radius: 0.1, smoothness: 8, material: "pants" },
      { id: "leftUpperArm", primitive: "roundedBox", args: [0.36, 0.67, 0.36], position: [-0.68, 1.24, 0], radius: 0.12, smoothness: 8, material: "shirt" },
      { id: "rightUpperArm", primitive: "roundedBox", args: [0.36, 0.67, 0.36], position: [0.68, 1.24, 0], radius: 0.12, smoothness: 8, material: "shirt" },
      { id: "leftHand", primitive: "roundedBox", args: [0.25, 0.26, 0.25], position: [-0.66, 0.73, 0], radius: 0.08, smoothness: 8, material: "skin" },
      { id: "rightHand", primitive: "roundedBox", args: [0.25, 0.26, 0.25], position: [0.66, 0.73, 0], radius: 0.08, smoothness: 8, material: "skin" },
      { id: "leftLeg", primitive: "roundedBox", args: [0.36, 0.88, 0.4], position: [-0.23, 0.44, 0], radius: 0.1, smoothness: 8, material: "pants" },
      { id: "rightLeg", primitive: "roundedBox", args: [0.36, 0.88, 0.4], position: [0.23, 0.44, 0], radius: 0.1, smoothness: 8, material: "pants" },
    ],
  },
];

export const STUDIO_ASSETS: StudioAsset[] = [
  { id: "pattern_houndstooth", name: "Houndstooth Pattern", category: "pattern", defaultColor: "#cbd5e1", supportedTemplates: ["shirt", "pants"], preferredZone: "front", overlayImage: OVERLAY_IMAGES.pattern_houndstooth },
  { id: "graphic_dragon", name: "Dragon Graphic", category: "graphic", defaultColor: "#f97316", supportedTemplates: ["shirt"], preferredZone: "front", overlayImage: OVERLAY_IMAGES.graphic_dragon, styleTags: ["fantasy"], vibeTags: ["heroic"], fantasyTags: ["dragon"], silhouetteTags: ["chest_focus"], role: "graphic", importance: "hero", exportable: true, previewOnly: false, compatibleGarments: ["shirt"] },
  { id: "graphic_skull", name: "Skull Symbol", category: "graphic", defaultColor: "#e2e8f0", supportedTemplates: ["shirt", "pants"], preferredZone: "front", overlayImage: OVERLAY_IMAGES.graphic_skull, styleTags: ["dark", "tactical"], vibeTags: ["grim"], fantasyTags: ["demon"], role: "graphic", importance: "support", exportable: true, previewOnly: false },
  { id: "trim_neon", name: "Neon Trim", category: "trim", defaultColor: "#22d3ee", supportedTemplates: ["shirt", "pants"], preferredZone: "left_sleeve", overlayImage: OVERLAY_IMAGES.trim_neon, styleTags: ["cyber"], role: "trim", importance: "decorative", exportable: true, previewOnly: false },
  { id: "trim_gold", name: "Gold Trim", category: "trim", defaultColor: "#f59e0b", supportedTemplates: ["shirt", "pants"], preferredZone: "right_sleeve", overlayImage: OVERLAY_IMAGES.trim_gold, styleTags: ["luxury", "fantasy"], role: "trim", importance: "decorative", exportable: true, previewOnly: false },
  { id: "patch_team", name: "Team Patch", category: "patch", defaultColor: "#3b82f6", supportedTemplates: ["shirt"], preferredZone: "back", overlayImage: OVERLAY_IMAGES.patch_team },
  { id: "accessory_chain", name: "Chain Accessory", category: "accessory", defaultColor: "#fde047", supportedTemplates: ["shirt"], preferredZone: "front", overlayImage: OVERLAY_IMAGES.accessory_chain },
  { id: "module_side_stripe", name: "Side Stripe Module", category: "module", defaultColor: "#a855f7", supportedTemplates: ["pants"], preferredZone: "left_leg_front", overlayImage: OVERLAY_IMAGES.module_side_stripe },
  { id: "module_pocket", name: "Pocket Module", category: "module", defaultColor: "#334155", supportedTemplates: ["pants"], preferredZone: "right_leg_front", overlayImage: OVERLAY_IMAGES.module_pocket },
  { id: "hair_preview_spiky", name: "Spiky Hair Preview", category: "hair", defaultColor: "#4b2e1f", supportedTemplates: ["shirt", "pants"], preferredZone: "front", overlayImage: OVERLAY_IMAGES.hair_preview_spiky },
];

export const AVATAR_ASSETS: AvatarAsset[] = [
  { id: "face_confident", name: "Confident Face", category: "face", slot: "face", color: "#111827", renderMode: "decal", modelPath: "/avatar/face/confident.png", decalTexture: FACE_DECALS.face_confident, styleTags: ["street", "sport", "hero"], role: "face", importance: "hero", exportable: false, previewOnly: true },
  { id: "face_smiley", name: "Smiley Face", category: "face", slot: "face", color: "#1f2937", renderMode: "decal", modelPath: "/avatar/face/smiley.png", decalTexture: FACE_DECALS.face_smiley, styleTags: ["casual", "friendly"] },
  { id: "face_stoic", name: "Stoic Face", category: "face", slot: "face", color: "#0f172a", renderMode: "decal", modelPath: "/avatar/face/stoic.png", decalTexture: FACE_DECALS.face_stoic, styleTags: ["dark", "tactical"], vibeTags: ["intense"], fantasyTags: ["demon"], role: "face", importance: "hero", exportable: false, previewOnly: true },
  { id: "face_anime_glint", name: "Anime Glint Face", category: "face", slot: "face", color: "#111827", renderMode: "decal", modelPath: "/avatar/face/anime-glint.png", decalTexture: FACE_DECALS.face_anime_glint, styleTags: ["anime", "vibrant"], vibeTags: ["magical"], fantasyTags: ["angel"], role: "face", importance: "hero", exportable: false, previewOnly: true },
  { id: "face_wink_star", name: "Wink Star Face", category: "face", slot: "face", color: "#111827", renderMode: "decal", modelPath: "/avatar/face/wink-star.png", decalTexture: FACE_DECALS.face_wink_star, styleTags: ["cute", "pop", "anime"] },

  { id: "hair_spiky_ember", name: "Spiky Ember Hair", category: "hair", slot: "hair", color: "#3b2a1d", renderMode: "part_kit", modelPath: "/avatar/hair/spiky-ember.glb", parts: hairSpikyParts, styleTags: ["street", "flame"], defaultOffset: { x: 0, y: 0.02, z: 0 }, previewOnly: true, exportable: false },
  { id: "hair_wavy_midnight", name: "Wavy Midnight Hair", category: "hair", slot: "hair", color: "#111827", renderMode: "part_kit", modelPath: "/avatar/hair/wavy-midnight.glb", parts: hairBobParts, styleTags: ["dark", "minimal"], previewOnly: true, exportable: false },
  { id: "hair_twin_tail_pop", name: "Twin Tail Pop", category: "hair", slot: "hair", color: "#1f2937", renderMode: "part_kit", modelPath: "/avatar/hair/twin-tail-pop.glb", parts: hairTwinTailParts, styleTags: ["anime", "cute"], previewOnly: true, exportable: false },
  { id: "hair_short", name: "Short Hair", category: "hair", slot: "hair", color: "#2d1f1a", renderMode: "part_kit", modelPath: "/avatar/hair/short.glb", parts: hairShortParts, styleTags: ["casual"], previewOnly: true, exportable: false },
  { id: "hair_long", name: "Long Hair", category: "hair", slot: "hair", color: "#2d1f1a", renderMode: "part_kit", modelPath: "/avatar/hair/long.glb", parts: hairLongParts, styleTags: ["elegant"], previewOnly: true, exportable: false },
  { id: "hair_ponytail", name: "Ponytail", category: "hair", slot: "hair", color: "#2d1f1a", renderMode: "part_kit", modelPath: "/avatar/hair/ponytail.glb", parts: hairPonytailParts, styleTags: ["sport"], previewOnly: true, exportable: false },
  { id: "hair_curly", name: "Curly Hair", category: "hair", slot: "hair", color: "#2d1f1a", renderMode: "part_kit", modelPath: "/avatar/hair/curly.glb", parts: hairCurlyParts, styleTags: ["playful"], previewOnly: true, exportable: false },
  { id: "hair_braids", name: "Braids", category: "hair", slot: "hair", color: "#2d1f1a", renderMode: "part_kit", modelPath: "/avatar/hair/braids.glb", parts: hairBraidsParts, styleTags: ["elegant"], previewOnly: true, exportable: false },

  { id: "hat_street_cap", name: "Street Cap", category: "hat", slot: "hat", color: "#0f172a", renderMode: "part_kit", modelPath: "/avatar/hat/street-cap.glb", parts: [makePart("roundedBox", [0.65, 0.22, 0.6], { radius: 0.15, position: [0, 0.04, 0], useAssetColor: true }), makePart("roundedBox", [0.38, 0.05, 0.23], { radius: 0.03, position: [0, 0.01, 0.37], useAssetColor: true })], styleTags: ["street", "sport"], previewOnly: true, exportable: false },
  { id: "hat_beanie_soft", name: "Soft Beanie", category: "hat", slot: "hat", color: "#334155", renderMode: "part_kit", modelPath: "/avatar/hat/soft-beanie.glb", parts: [makePart("roundedBox", [0.62, 0.32, 0.58], { radius: 0.17, useAssetColor: true }), makePart("roundedBox", [0.66, 0.09, 0.62], { radius: 0.05, position: [0, -0.14, 0], color: "#0f172a" })], styleTags: ["dark", "winter"], previewOnly: true, exportable: false },
  { id: "hat_cyber_horns", name: "Cyber Horns", category: "hat", slot: "hat", color: "#38bdf8", renderMode: "part_kit", modelPath: "/avatar/hat/cyber-horns.glb", parts: [makePart("cone", [0.06, 0.34, 16], { position: [-0.2, 0.1, -0.1], rotation: [0, 0, 0.35], useAssetColor: true, emissive: "#38bdf8", emissiveIntensity: 0.28 }), makePart("cone", [0.06, 0.34, 16], { position: [0.2, 0.1, -0.1], rotation: [0, 0, -0.35], useAssetColor: true, emissive: "#38bdf8", emissiveIntensity: 0.28 })], styleTags: ["cyber", "tech"], fantasyTags: ["demon", "dragon"], silhouetteTags: ["horns"], role: "headwear", importance: "hero", exportable: false, previewOnly: true },
  
  { id: "hat_helmet", name: "Helmet", category: "hat", slot: "hat", color: "#94a3b8", renderMode: "part_kit", modelPath: "/avatar/hat/helmet.glb", parts: [makePart("roundedBox", [0.68, 0.38, 0.64], { radius: 0.18, useAssetColor: true, metalness: 0.5, roughness: 0.4 }), makePart("roundedBox", [0.7, 0.12, 0.66], { radius: 0.08, position: [0, -0.16, 0], color: "#64748b", metalness: 0.55, roughness: 0.38 })], styleTags: ["tactical", "sport"], previewOnly: true, exportable: false },
  { id: "hat_crown", name: "Crown", category: "hat", slot: "hat", color: "#fbbf24", renderMode: "part_kit", modelPath: "/avatar/hat/crown.glb", parts: [makePart("torus", [0.32, 0.06, 16, 32], { rotation: [Math.PI / 2, 0, 0], position: [0, 0.02, 0], useAssetColor: true, metalness: 0.7, roughness: 0.3 }), makePart("cone", [0.05, 0.14, 12], { position: [-0.22, 0.14, 0], useAssetColor: true, metalness: 0.7, roughness: 0.3 }), makePart("cone", [0.05, 0.14, 12], { position: [-0.11, 0.14, 0.1], useAssetColor: true, metalness: 0.7, roughness: 0.3 }), makePart("cone", [0.05, 0.14, 12], { position: [0, 0.14, 0.13], useAssetColor: true, metalness: 0.7, roughness: 0.3 }), makePart("cone", [0.05, 0.14, 12], { position: [0.11, 0.14, 0.1], useAssetColor: true, metalness: 0.7, roughness: 0.3 }), makePart("cone", [0.05, 0.14, 12], { position: [0.22, 0.14, 0], useAssetColor: true, metalness: 0.7, roughness: 0.3 })], styleTags: ["fantasy", "luxury"], previewOnly: true, exportable: false },
  { id: "hat_glasses", name: "Glasses", category: "hat", slot: "hat", color: "#0f172a", renderMode: "part_kit", modelPath: "/avatar/hat/glasses.glb", parts: [makePart("torus", [0.08, 0.02, 12, 20], { position: [-0.14, 0, 0.28], rotation: [Math.PI / 2, 0, 0], useAssetColor: true }), makePart("torus", [0.08, 0.02, 12, 20], { position: [0.14, 0, 0.28], rotation: [Math.PI / 2, 0, 0], useAssetColor: true }), makePart("cylinder", [0.015, 0.015, 0.08, 8], { position: [0, 0, 0.28], rotation: [0, 0, Math.PI / 2], color: "#475569" })], styleTags: ["casual", "smart"], previewOnly: true, exportable: false },
  { id: "hat_mask", name: "Mask", category: "hat", slot: "hat", color: "#1e293b", renderMode: "part_kit", modelPath: "/avatar/hat/mask.glb", parts: [makePart("roundedBox", [0.5, 0.24, 0.1], { radius: 0.08, position: [0, -0.08, 0.3], useAssetColor: true })], styleTags: ["tactical", "dark"], previewOnly: true, exportable: false },

  { id: "hat_unicorn", name: "Unicorn Hat", category: "hat", slot: "hat", color: "#fbbf24", renderMode: "part_kit", modelPath: "/avatar/hat/unicorn.glb", parts: [
    // White headband/cap base sitting on head
    makePart("roundedBox", [0.66, 0.18, 0.6], { radius: 0.12, position: [0, 0.01, 0], color: "#f8fafc" }),
    // Left ear - white with pink inner
    makePart("cone", [0.08, 0.16, 12], { position: [-0.24, 0.16, 0.04], rotation: [0.2, 0, -0.4], color: "#f8fafc" }),
    makePart("cone", [0.05, 0.11, 12], { position: [-0.24, 0.16, 0.05], rotation: [0.2, 0, -0.4], color: "#fda4af" }),
    // Right ear - white with pink inner
    makePart("cone", [0.08, 0.16, 12], { position: [0.24, 0.16, 0.04], rotation: [0.2, 0, 0.4], color: "#f8fafc" }),
    makePart("cone", [0.05, 0.11, 12], { position: [0.24, 0.16, 0.05], rotation: [0.2, 0, 0.4], color: "#fda4af" }),
    // Gold spiral horn (stacked tapering cones) - tinted by AI color
    makePart("cone", [0.055, 0.14, 16], { position: [0, 0.18, 0.14], rotation: [0.15, 0, 0], useAssetColor: true, metalness: 0.5, roughness: 0.3 }),
    makePart("cone", [0.045, 0.12, 16], { position: [0, 0.28, 0.16], rotation: [0.12, 0.1, 0], useAssetColor: true, metalness: 0.5, roughness: 0.3 }),
    makePart("cone", [0.035, 0.1, 16], { position: [0, 0.36, 0.18], rotation: [0.1, 0.15, 0], useAssetColor: true, metalness: 0.5, roughness: 0.3 }),
    // Pastel rainbow mane strip down the back (pink/purple/turquoise segments)
    makePart("roundedBox", [0.16, 0.08, 0.12], { radius: 0.04, position: [0, 0.1, -0.24], color: "#fbcfe8" }),
    makePart("roundedBox", [0.14, 0.08, 0.1], { radius: 0.04, position: [0, 0.04, -0.32], color: "#e9d5ff" }),
    makePart("roundedBox", [0.12, 0.08, 0.08], { radius: 0.04, position: [0, -0.02, -0.38], color: "#a5f3fc" }),
  ], styleTags: ["fantasy", "cute"], fantasyTags: ["unicorn"], previewOnly: true, exportable: false },

  { id: "hat_dragon", name: "Dragon Hood", category: "hat", slot: "hat", color: "#22c55e", renderMode: "part_kit", modelPath: "/avatar/hat/dragon.glb", parts: [
    // Hood shell over top/back of head - uses asset color
    makePart("roundedBox", [0.68, 0.32, 0.58], { radius: 0.16, position: [0, 0.04, -0.04], useAssetColor: true }),
    // Protruding snout box in front (above the face)
    makePart("roundedBox", [0.24, 0.18, 0.28], { radius: 0.08, position: [0, -0.02, 0.38], useAssetColor: true }),
    // White teeth under snout edge
    makePart("cone", [0.03, 0.08, 8], { position: [-0.06, -0.12, 0.48], rotation: [Math.PI, 0, 0], color: "#f8fafc" }),
    makePart("cone", [0.03, 0.08, 8], { position: [0.06, -0.12, 0.48], rotation: [Math.PI, 0, 0], color: "#f8fafc" }),
    // Two small horns/back-spikes on top
    makePart("cone", [0.045, 0.12, 12], { position: [-0.12, 0.22, -0.06], rotation: [-0.3, 0, -0.2], useAssetColor: true }),
    makePart("cone", [0.045, 0.12, 12], { position: [0.12, 0.22, -0.06], rotation: [-0.3, 0, 0.2], useAssetColor: true }),
    // Left cartoon eye bump (white sphere + dark pupil)
    makePart("sphere", [0.08, 12, 12], { position: [-0.16, 0.08, 0.26], color: "#f8fafc" }),
    makePart("sphere", [0.04, 12, 12], { position: [-0.18, 0.08, 0.32], color: "#0f172a" }),
    // Right cartoon eye bump (white sphere + dark pupil)
    makePart("sphere", [0.08, 12, 12], { position: [0.16, 0.08, 0.26], color: "#f8fafc" }),
    makePart("sphere", [0.04, 12, 12], { position: [0.18, 0.08, 0.32], color: "#0f172a" }),
  ], styleTags: ["fantasy", "cute"], fantasyTags: ["dragon"], previewOnly: true, exportable: false },

  { id: "neck_chain_gold", name: "Gold Chain", category: "neck", slot: "neck", color: "#facc15", renderMode: "part_kit", modelPath: "/avatar/neck/gold-chain.glb", parts: [makePart("torus", [0.2, 0.03, 16, 36], { rotation: [Math.PI / 2, 0, 0], useAssetColor: true, metalness: 0.74, roughness: 0.35 }), makePart("sphere", [0.05, 12, 12], { position: [0, -0.12, 0.08], color: "#fde68a", metalness: 0.66, roughness: 0.3 })], styleTags: ["street", "luxury"], previewOnly: true, exportable: false },
  { id: "neck_scarf_neo", name: "Neo Scarf", category: "neck", slot: "neck", color: "#22c55e", renderMode: "part_kit", modelPath: "/avatar/neck/neo-scarf.glb", parts: [makePart("torus", [0.24, 0.06, 12, 30], { rotation: [Math.PI / 2, 0, 0], useAssetColor: true }), makePart("roundedBox", [0.12, 0.3, 0.08], { radius: 0.03, position: [0.1, -0.2, 0.2], useAssetColor: true })], styleTags: ["cyber", "winter"], previewOnly: true, exportable: false },
  
  { id: "neck_belt", name: "Belt", category: "neck", slot: "neck", color: "#78350f", renderMode: "part_kit", modelPath: "/avatar/neck/belt.glb", parts: [
    makePart("torus", [0.36, 0.025, 16, 32], { rotation: [Math.PI / 2, 0, 0], position: [0, -0.65, 0], useAssetColor: true }),
    makePart("roundedBox", [0.08, 0.06, 0.04], { radius: 0.02, position: [0, -0.65, 0.36], color: "#fbbf24", metalness: 0.6, roughness: 0.3 }),
  ], styleTags: ["casual", "western"], previewOnly: true, exportable: false },
  
  { id: "neck_gloves", name: "Gloves", category: "neck", slot: "neck", color: "#0f172a", renderMode: "part_kit", modelPath: "/avatar/neck/gloves.glb", parts: [
    makePart("roundedBox", [0.46, 0.2, 0.48], { radius: 0.08, position: [-0.73, -0.92, 0], useAssetColor: true }),
    makePart("roundedBox", [0.46, 0.2, 0.48], { radius: 0.08, position: [0.73, -0.92, 0], useAssetColor: true }),
  ], styleTags: ["tactical", "winter"], previewOnly: true, exportable: false },

  { id: "shoulder_orb_left", name: "Left Shoulder Pet", category: "shoulder", slot: "leftShoulder", color: "#60a5fa", renderMode: "part_kit", modelPath: "/avatar/shoulder/orb-left.glb", parts: [makePart("sphere", [0.13, 18, 18], { useAssetColor: true, roughness: 0.45 }), makePart("sphere", [0.07, 12, 12], { position: [0, -0.04, 0.1], color: "#f8fafc" }), makePart("sphere", [0.01, 8, 8], { position: [-0.035, 0.03, 0.12], color: "#0f172a" }), makePart("sphere", [0.01, 8, 8], { position: [0.035, 0.03, 0.12], color: "#0f172a" })] },
  { id: "shoulder_orb_right", name: "Right Shoulder Pet", category: "shoulder", slot: "rightShoulder", color: "#60a5fa", renderMode: "part_kit", modelPath: "/avatar/shoulder/orb-right.glb", parts: [makePart("sphere", [0.13, 18, 18], { useAssetColor: true, roughness: 0.45 }), makePart("sphere", [0.07, 12, 12], { position: [0, -0.04, 0.1], color: "#f8fafc" }), makePart("sphere", [0.01, 8, 8], { position: [-0.035, 0.03, 0.12], color: "#0f172a" }), makePart("sphere", [0.01, 8, 8], { position: [0.035, 0.03, 0.12], color: "#0f172a" })] },
  { id: "shoulder_guard_left", name: "Left Shoulder Guard", category: "shoulder", slot: "leftShoulder", color: "#94a3b8", renderMode: "part_kit", modelPath: "/avatar/shoulder/guard-left.glb", parts: [makePart("roundedBox", [0.24, 0.17, 0.3], { radius: 0.08, useAssetColor: true, metalness: 0.55, roughness: 0.5 }), makePart("roundedBox", [0.26, 0.08, 0.08], { radius: 0.02, position: [0, -0.08, 0.08], color: "#cbd5e1", metalness: 0.66, roughness: 0.45 })], styleTags: ["cyber", "tactical"], fantasyTags: ["demon", "angel"], role: "armor", importance: "support", exportable: false, previewOnly: true },
  { id: "shoulder_guard_right", name: "Right Shoulder Guard", category: "shoulder", slot: "rightShoulder", color: "#94a3b8", renderMode: "part_kit", modelPath: "/avatar/shoulder/guard-right.glb", parts: [makePart("roundedBox", [0.24, 0.17, 0.3], { radius: 0.08, useAssetColor: true, metalness: 0.55, roughness: 0.5 }), makePart("roundedBox", [0.26, 0.08, 0.08], { radius: 0.02, position: [0, -0.08, 0.08], color: "#cbd5e1", metalness: 0.66, roughness: 0.45 })], styleTags: ["cyber", "tactical"], fantasyTags: ["demon", "angel"], role: "armor", importance: "support", exportable: false, previewOnly: true },

  { id: "back_jetpack_mini", name: "Mini Jetpack", category: "back", slot: "back", color: "#334155", renderMode: "part_kit", modelPath: "/avatar/back/jetpack-mini.glb", parts: [makePart("roundedBox", [0.44, 0.54, 0.2], { radius: 0.08, useAssetColor: true }), makePart("roundedBox", [0.14, 0.2, 0.08], { radius: 0.03, position: [0, -0.08, 0.14], color: "#94a3b8" }), makePart("roundedBox", [0.08, 0.55, 0.05], { radius: 0.02, position: [-0.18, 0, 0.09], color: "#1e293b" }), makePart("roundedBox", [0.08, 0.55, 0.05], { radius: 0.02, position: [0.18, 0, 0.09], color: "#1e293b" })], styleTags: ["cyber", "tech"], silhouetteTags: ["tech_backpack"], role: "wings", importance: "hero", exportable: false, previewOnly: true },
  { id: "back_blade_rig", name: "Blade Rig", category: "back", slot: "back", color: "#64748b", renderMode: "part_kit", modelPath: "/avatar/back/blade-rig.glb", parts: [makePart("box", [0.05, 0.65, 0.08], { position: [-0.12, 0.2, 0.1], rotation: [0.2, 0, -0.5], color: "#e2e8f0", metalness: 0.7, roughness: 0.34 }), makePart("box", [0.05, 0.65, 0.08], { position: [0.1, 0.14, 0.06], rotation: [0.2, 0, 0.5], color: "#cbd5e1", metalness: 0.72, roughness: 0.36 }), makePart("roundedBox", [0.25, 0.18, 0.14], { radius: 0.03, position: [0, -0.06, 0], useAssetColor: true })], styleTags: ["dark", "flame", "tactical"], fantasyTags: ["dragon", "demon"], silhouetteTags: ["wing_like"], role: "wings", importance: "hero", exportable: false, previewOnly: true },
  
  { id: "back_wings", name: "Wings", category: "back", slot: "back", color: "#e0f2fe", renderMode: "part_kit", modelPath: "/avatar/back/wings.glb", parts: [
    makePart("roundedBox", [0.16, 0.5, 0.08], { radius: 0.06, position: [-0.28, 0.08, -0.08], rotation: [0, 0, -0.4], useAssetColor: true, opacity: 0.85, transparent: true }),
    makePart("roundedBox", [0.14, 0.42, 0.06], { radius: 0.05, position: [-0.42, 0.02, -0.12], rotation: [0, 0, -0.5], useAssetColor: true, opacity: 0.8, transparent: true }),
    makePart("roundedBox", [0.12, 0.34, 0.05], { radius: 0.04, position: [-0.54, -0.06, -0.14], rotation: [0, 0, -0.6], useAssetColor: true, opacity: 0.75, transparent: true }),
    makePart("roundedBox", [0.16, 0.5, 0.08], { radius: 0.06, position: [0.28, 0.08, -0.08], rotation: [0, 0, 0.4], useAssetColor: true, opacity: 0.85, transparent: true }),
    makePart("roundedBox", [0.14, 0.42, 0.06], { radius: 0.05, position: [0.42, 0.02, -0.12], rotation: [0, 0, 0.5], useAssetColor: true, opacity: 0.8, transparent: true }),
    makePart("roundedBox", [0.12, 0.34, 0.05], { radius: 0.04, position: [0.54, -0.06, -0.14], rotation: [0, 0, 0.6], useAssetColor: true, opacity: 0.75, transparent: true }),
  ], styleTags: ["fantasy", "angel"], previewOnly: true, exportable: false },
  
  { id: "back_backpack", name: "Backpack", category: "back", slot: "back", color: "#475569", renderMode: "part_kit", modelPath: "/avatar/back/backpack.glb", parts: [
    makePart("roundedBox", [0.42, 0.52, 0.22], { radius: 0.08, useAssetColor: true }),
    makePart("roundedBox", [0.32, 0.16, 0.06], { radius: 0.04, position: [0, 0.06, 0.13], color: "#64748b" }),
    makePart("roundedBox", [0.06, 0.5, 0.04], { radius: 0.02, position: [-0.14, 0.1, 0.12], color: "#334155" }),
    makePart("roundedBox", [0.06, 0.5, 0.04], { radius: 0.02, position: [0.14, 0.1, 0.12], color: "#334155" }),
  ], styleTags: ["casual", "sport"], previewOnly: true, exportable: false },
  
  { id: "back_bag", name: "Bag", category: "back", slot: "back", color: "#1e293b", renderMode: "part_kit", modelPath: "/avatar/back/bag.glb", parts: [
    makePart("roundedBox", [0.24, 0.3, 0.14], { radius: 0.06, position: [0.22, -0.3, 0.08], useAssetColor: true }),
    makePart("cylinder", [0.025, 0.025, 0.7, 12], { position: [-0.12, 0.06, 0.12], rotation: [0, 0, 0.8], color: "#475569" }),
  ], styleTags: ["casual", "street"], previewOnly: true, exportable: false },
  
  { id: "back_tail", name: "Tail", category: "back", slot: "back", color: "#78350f", renderMode: "part_kit", modelPath: "/avatar/back/tail.glb", parts: [
    makePart("cylinder", [0.06, 0.08, 0.18, 12], { position: [0, -0.14, -0.1], rotation: [0.4, 0, 0], useAssetColor: true }),
    makePart("cylinder", [0.055, 0.07, 0.16, 12], { position: [0, -0.3, -0.14], rotation: [0.6, 0, 0], useAssetColor: true }),
    makePart("cylinder", [0.05, 0.06, 0.14, 12], { position: [0, -0.44, -0.2], rotation: [0.75, 0, 0], useAssetColor: true }),
    makePart("cone", [0.055, 0.12, 12], { position: [0, -0.54, -0.26], rotation: [0.9, 0, 0], useAssetColor: true }),
  ], styleTags: ["fantasy", "creature"], previewOnly: true, exportable: false },

  { id: "footwear_runner_black", name: "Runner Black", category: "footwear", slot: "leftFootwear", color: "#111111", renderMode: "part_kit", modelPath: "/avatar/footwear/runner-left.glb", parts: [makePart("roundedBox", [0.27, 0.18, 0.4], { radius: 0.06, useAssetColor: true }), makePart("roundedBox", [0.25, 0.05, 0.42], { radius: 0.02, position: [0, -0.08, 0], color: "#e2e8f0" })], styleTags: ["street", "sport"] },
  { id: "footwear_runner_black_right", name: "Runner Black (Right)", category: "footwear", slot: "rightFootwear", color: "#111111", renderMode: "part_kit", modelPath: "/avatar/footwear/runner-right.glb", parts: [makePart("roundedBox", [0.27, 0.18, 0.4], { radius: 0.06, useAssetColor: true }), makePart("roundedBox", [0.25, 0.05, 0.42], { radius: 0.02, position: [0, -0.08, 0], color: "#e2e8f0" })], styleTags: ["street", "sport"] },
  { id: "footwear_tech_boot_l", name: "Tech Boot (Left)", category: "footwear", slot: "leftFootwear", color: "#1e293b", renderMode: "part_kit", modelPath: "/avatar/footwear/tech-boot-left.glb", parts: [makePart("roundedBox", [0.28, 0.28, 0.36], { radius: 0.06, useAssetColor: true, metalness: 0.2 }), makePart("roundedBox", [0.29, 0.08, 0.38], { radius: 0.02, position: [0, -0.12, 0], color: "#334155" })], styleTags: ["cyber", "tactical"] },
  { id: "footwear_tech_boot_r", name: "Tech Boot (Right)", category: "footwear", slot: "rightFootwear", color: "#1e293b", renderMode: "part_kit", modelPath: "/avatar/footwear/tech-boot-right.glb", parts: [makePart("roundedBox", [0.28, 0.28, 0.36], { radius: 0.06, useAssetColor: true, metalness: 0.2 }), makePart("roundedBox", [0.29, 0.08, 0.38], { radius: 0.02, position: [0, -0.12, 0], color: "#334155" })], styleTags: ["cyber", "tactical"] },

  { id: "aura_neon_ring", name: "Neon Aura", category: "aura", slot: "aura", color: "#22d3ee", renderMode: "part_kit", modelPath: "/avatar/aura/neon-ring.glb", parts: [makePart("torus", [0.78, 0.05, 16, 40], { rotation: [Math.PI / 2, 0, 0], useAssetColor: true, emissive: "#22d3ee", emissiveIntensity: 0.5, transparent: true, opacity: 0.72 })], styleTags: ["street", "cyber"], fantasyTags: ["angel"], role: "aura", importance: "decorative", previewOnly: true, exportable: false },
  { id: "aura_flame_orbit", name: "Flame Orbit", category: "aura", slot: "aura", color: "#f97316", renderMode: "part_kit", modelPath: "/avatar/aura/flame-orbit.glb", parts: [makePart("torus", [0.78, 0.03, 10, 36], { rotation: [Math.PI / 2, 0, 0], useAssetColor: true, emissive: "#f97316", emissiveIntensity: 0.65, transparent: true, opacity: 0.65 }), makePart("cone", [0.08, 0.28, 10], { position: [-0.55, 0.1, 0], color: "#fb923c", emissive: "#f97316", emissiveIntensity: 0.45, transparent: true, opacity: 0.78 }), makePart("cone", [0.08, 0.28, 10], { position: [-0.25, 0.14, 0], color: "#fb923c", emissive: "#f97316", emissiveIntensity: 0.45, transparent: true, opacity: 0.78 }), makePart("cone", [0.08, 0.28, 10], { position: [0, 0.1, 0], color: "#fb923c", emissive: "#f97316", emissiveIntensity: 0.45, transparent: true, opacity: 0.78 }), makePart("cone", [0.08, 0.28, 10], { position: [0.25, 0.14, 0], color: "#fb923c", emissive: "#f97316", emissiveIntensity: 0.45, transparent: true, opacity: 0.78 }), makePart("cone", [0.08, 0.28, 10], { position: [0.55, 0.1, 0], color: "#fb923c", emissive: "#f97316", emissiveIntensity: 0.45, transparent: true, opacity: 0.78 })], styleTags: ["flame", "hero"], fantasyTags: ["dragon", "demon"], role: "aura", importance: "decorative", previewOnly: true, exportable: false },
  { id: "aura_pixel_spark", name: "Pixel Spark", category: "aura", slot: "aura", color: "#a855f7", renderMode: "part_kit", modelPath: "/avatar/aura/pixel-spark.glb", parts: [makePart("box", [0.08, 0.08, 0.08], { position: [-0.55, -0.03, -0.12], useAssetColor: true, emissive: "#a855f7", emissiveIntensity: 0.44 }), makePart("box", [0.08, 0.08, 0.08], { position: [-0.25, 0.1, 0.12], useAssetColor: true, emissive: "#a855f7", emissiveIntensity: 0.44 }), makePart("box", [0.08, 0.08, 0.08], { position: [0.05, -0.03, -0.12], useAssetColor: true, emissive: "#a855f7", emissiveIntensity: 0.44 }), makePart("box", [0.08, 0.08, 0.08], { position: [0.3, 0.1, 0.12], useAssetColor: true, emissive: "#a855f7", emissiveIntensity: 0.44 }), makePart("box", [0.08, 0.08, 0.08], { position: [0.6, -0.03, -0.12], useAssetColor: true, emissive: "#a855f7", emissiveIntensity: 0.44 })], styleTags: ["cyber", "pixel"] },
];

const STUDIO_ASSET_MAP = new Map(STUDIO_ASSETS.map((asset) => [asset.id, asset] as const));
const AVATAR_ASSET_MAP = new Map(AVATAR_ASSETS.map((asset) => [asset.id, asset] as const));
const AVATAR_BASE_MAP = new Map(AVATAR_BASE_MODELS.map((model) => [model.id, model] as const));

export function getAssetsForTemplate(template: TemplateType) {
  return STUDIO_ASSETS.filter((asset) => asset.supportedTemplates.includes(template));
}

function hasTag(assetTags: string[] | undefined, tag?: string) {
  if (!tag || tag === "all") return true;
  return (assetTags ?? []).includes(tag);
}

function matchesExportFilter(previewOnly: boolean | undefined, exportable: boolean | undefined, filter: AssetBrowserExportFilter = "all") {
  if (filter === "exportable") return exportable === true;
  if (filter === "previewOnly") return previewOnly === true;
  return true;
}

function matchesSearch(asset: { id: string; name: string }, search?: string) {
  if (!search?.trim()) return true;
  const normalized = search.trim().toLowerCase();
  return asset.name.toLowerCase().includes(normalized) || asset.id.toLowerCase().includes(normalized);
}

export function filterStudioAssets(
  assets: StudioAsset[],
  filters: SharedAssetFilters & { category?: AssetCategory | "all"; zone?: string | "all" },
) {
  return assets.filter((asset) => {
    if (filters.category && filters.category !== "all" && asset.category !== filters.category) return false;
    if (filters.zone && filters.zone !== "all" && asset.preferredZone !== filters.zone) return false;
    if (filters.role && filters.role !== "all" && asset.role !== filters.role) return false;
    if (filters.importance && filters.importance !== "all" && asset.importance !== filters.importance) return false;
    if (!hasTag(asset.styleTags, filters.styleTag)) return false;
    if (!hasTag(asset.vibeTags, filters.vibeTag)) return false;
    if (!hasTag(asset.fantasyTags, filters.fantasyTag)) return false;
    if (!matchesExportFilter(asset.previewOnly, asset.exportable, filters.exportFilter)) return false;
    if (!matchesSearch(asset, filters.search)) return false;
    return true;
  });
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

export function filterAvatarAssets(
  assets: AvatarAsset[],
  filters: SharedAssetFilters & { slot?: AvatarCosmeticSlot | "all"; category?: AvatarAssetCategory | "all" },
) {
  return assets.filter((asset) => {
    if (filters.slot && filters.slot !== "all" && asset.slot !== filters.slot) return false;
    if (filters.category && filters.category !== "all" && asset.category !== filters.category) return false;
    if (filters.role && filters.role !== "all" && asset.role !== filters.role) return false;
    if (filters.importance && filters.importance !== "all" && asset.importance !== filters.importance) return false;
    if (!hasTag(asset.styleTags, filters.styleTag)) return false;
    if (!hasTag(asset.vibeTags, filters.vibeTag)) return false;
    if (!hasTag(asset.fantasyTags, filters.fantasyTag)) return false;
    if (!matchesExportFilter(asset.previewOnly, asset.exportable, filters.exportFilter)) return false;
    if (!matchesSearch(asset, filters.search)) return false;
    return true;
  });
}

export function collectAssetTags(assets: Array<Pick<StudioAsset | AvatarAsset, "styleTags" | "vibeTags" | "fantasyTags">>) {
  const styles = new Set<string>();
  const vibes = new Set<string>();
  const fantasy = new Set<string>();
  for (const asset of assets) {
    for (const tag of asset.styleTags ?? []) styles.add(tag);
    for (const tag of asset.vibeTags ?? []) vibes.add(tag);
    for (const tag of asset.fantasyTags ?? []) fantasy.add(tag);
  }
  return {
    styleTags: [...styles].sort(),
    vibeTags: [...vibes].sort(),
    fantasyTags: [...fantasy].sort(),
  };
}

export function getAvatarBaseModel(modelVariant: AvatarBaseModel["id"]) {
  return AVATAR_BASE_MAP.get(modelVariant) ?? AVATAR_BASE_MODELS[1];
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
