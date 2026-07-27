/** Deterministic fashion knowledge. Image models may texture these modules, never define them. */
export const GARMENT_KEYS = [
  "hoodie",
  "crew-neck",
  "t-shirt",
  "zip-hoodie",
  "jeans",
  "cargo-pants",
  "joggers",
  "football-jersey",
] as const;
export type GarmentKey = (typeof GARMENT_KEYS)[number];
export type GarmentModule =
  | "hood"
  | "hood-opening"
  | "drawstrings"
  | "kangaroo-pocket"
  | "zipper"
  | "crew-collar"
  | "shoulder-seams"
  | "sleeve-seams"
  | "side-seams"
  | "rib-cuffs"
  | "rib-hem"
  | "sleeve-hems"
  | "lower-hem"
  | "waistband"
  | "fly"
  | "front-pockets"
  | "back-pockets"
  | "belt-loops"
  | "cargo-pockets"
  | "drawcord"
  | "leg-cuffs"
  | "inseams"
  | "side-stripes";
export type ModuleParameters = {
  size: number;
  position: readonly [number, number];
  curvature: number;
  depth: number;
  shadow: number;
  highlight: number;
  normalDirection: readonly [number, number, number];
  edgeWear: number;
};
export type GarmentTemplate = {
  key: GarmentKey;
  atlas: "shirt" | "pants";
  requiredModules: readonly GarmentModule[];
  optionalModules: readonly GarmentModule[];
  uvAnchors: Readonly<Record<string, readonly [number, number]>>;
  shadowPreset: "soft-knit" | "structured" | "athletic";
  foldPreset: {
    locations: readonly string[];
    intensity: number;
    gravity: number;
  };
  constructionRules: readonly string[];
  defaultMaterial: string;
};
const topAnchors = {
  front: [260, 160],
  back: [402, 160],
  rightSleeve: [92, 180],
  leftSleeve: [489, 350],
} as const;
const pantsAnchors = {
  front: [260, 145],
  back: [402, 145],
  rightLeg: [92, 350],
  leftLeg: [489, 350],
} as const;
export const GARMENT_LIBRARY: Record<GarmentKey, GarmentTemplate> = {
  hoodie: {
    key: "hoodie",
    atlas: "shirt",
    requiredModules: [
      "hood",
      "hood-opening",
      "drawstrings",
      "kangaroo-pocket",
      "shoulder-seams",
      "sleeve-seams",
      "rib-cuffs",
      "rib-hem",
    ],
    optionalModules: [],
    uvAnchors: topAnchors,
    shadowPreset: "soft-knit",
    foldPreset: {
      locations: ["underarms", "pocket corners", "cuffs", "hem"],
      intensity: 0.62,
      gravity: 0.8,
    },
    constructionRules: [
      "two-piece hood has a center-back seam",
      "kangaroo pocket is symmetric about center front",
      "cuffs and hem use rib knit",
    ],
    defaultMaterial: "heavy cotton fleece",
  },
  "crew-neck": {
    key: "crew-neck",
    atlas: "shirt",
    requiredModules: [
      "crew-collar",
      "shoulder-seams",
      "sleeve-seams",
      "rib-cuffs",
      "rib-hem",
    ],
    optionalModules: [],
    uvAnchors: topAnchors,
    shadowPreset: "soft-knit",
    foldPreset: {
      locations: ["collar", "underarms", "cuffs"],
      intensity: 0.5,
      gravity: 0.75,
    },
    constructionRules: [
      "set-in sleeves join at armholes",
      "collar, cuffs and hem use rib knit",
    ],
    defaultMaterial: "cotton fleece",
  },
  "t-shirt": {
    key: "t-shirt",
    atlas: "shirt",
    requiredModules: [
      "crew-collar",
      "shoulder-seams",
      "side-seams",
      "sleeve-hems",
      "lower-hem",
    ],
    optionalModules: [],
    uvAnchors: topAnchors,
    shadowPreset: "soft-knit",
    foldPreset: {
      locations: ["collar", "underarms", "lower hem"],
      intensity: 0.36,
      gravity: 0.7,
    },
    constructionRules: [
      "neck is rib bound",
      "sleeve and lower hems are double needle",
    ],
    defaultMaterial: "cotton jersey",
  },
  "zip-hoodie": {
    key: "zip-hoodie",
    atlas: "shirt",
    requiredModules: [
      "hood",
      "hood-opening",
      "drawstrings",
      "zipper",
      "front-pockets",
      "shoulder-seams",
      "sleeve-seams",
      "rib-cuffs",
      "rib-hem",
    ],
    optionalModules: [],
    uvAnchors: topAnchors,
    shadowPreset: "soft-knit",
    foldPreset: {
      locations: ["zipper", "underarms", "pocket corners", "cuffs"],
      intensity: 0.6,
      gravity: 0.8,
    },
    constructionRules: [
      "zipper is centered and continuous",
      "front pockets are mirrored welt pockets",
      "two-piece hood has center-back seam",
    ],
    defaultMaterial: "heavy cotton fleece",
  },
  jeans: {
    key: "jeans",
    atlas: "pants",
    requiredModules: [
      "waistband",
      "fly",
      "front-pockets",
      "back-pockets",
      "belt-loops",
      "side-seams",
      "inseams",
    ],
    optionalModules: [],
    uvAnchors: pantsAnchors,
    shadowPreset: "structured",
    foldPreset: {
      locations: ["hips", "crotch", "knees", "ankles"],
      intensity: 0.68,
      gravity: 0.82,
    },
    constructionRules: [
      "felled inseams use double topstitching",
      "rear yoke shapes seat",
      "pockets have reinforced corners",
    ],
    defaultMaterial: "denim twill",
  },
  "cargo-pants": {
    key: "cargo-pants",
    atlas: "pants",
    requiredModules: [
      "waistband",
      "fly",
      "front-pockets",
      "cargo-pockets",
      "side-seams",
      "inseams",
    ],
    optionalModules: ["leg-cuffs"],
    uvAnchors: pantsAnchors,
    shadowPreset: "structured",
    foldPreset: {
      locations: ["hips", "cargo pocket bellows", "knees", "ankles"],
      intensity: 0.7,
      gravity: 0.85,
    },
    constructionRules: [
      "cargo pockets have flaps and bellows",
      "knees articulate independently",
    ],
    defaultMaterial: "cotton canvas",
  },
  joggers: {
    key: "joggers",
    atlas: "pants",
    requiredModules: [
      "waistband",
      "drawcord",
      "front-pockets",
      "side-seams",
      "inseams",
      "leg-cuffs",
    ],
    optionalModules: [],
    uvAnchors: pantsAnchors,
    shadowPreset: "soft-knit",
    foldPreset: {
      locations: ["waist", "hips", "knees", "cuffs"],
      intensity: 0.58,
      gravity: 0.8,
    },
    constructionRules: [
      "elastic waist and cuffs compress fabric",
      "drawcord is centered",
    ],
    defaultMaterial: "cotton fleece",
  },
  "football-jersey": {
    key: "football-jersey",
    atlas: "shirt",
    requiredModules: [
      "crew-collar",
      "shoulder-seams",
      "side-seams",
      "sleeve-hems",
      "lower-hem",
    ],
    optionalModules: ["side-stripes"],
    uvAnchors: topAnchors,
    shadowPreset: "athletic",
    foldPreset: {
      locations: ["shoulders", "underarms", "waist"],
      intensity: 0.3,
      gravity: 0.55,
    },
    constructionRules: [
      "mesh panels align at side seams",
      "openings use athletic binding",
    ],
    defaultMaterial: "performance mesh",
  },
};
export function resolveGarmentKey(value: string): GarmentKey {
  const v = value.toLowerCase();
  if (/zip[- ]?(up )?hoodie/.test(v)) return "zip-hoodie";
  if (v.includes("hoodie")) return "hoodie";
  if (/crew ?neck|sweatshirt/.test(v)) return "crew-neck";
  if (/football|soccer/.test(v) && v.includes("jersey"))
    return "football-jersey";
  if (/cargo/.test(v)) return "cargo-pants";
  if (/jogger|sweatpant/.test(v)) return "joggers";
  if (/jean|denim/.test(v)) return "jeans";
  return "t-shirt";
}
