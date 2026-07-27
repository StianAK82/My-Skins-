import { createHash, randomUUID } from "node:crypto";
import {
  GARMENT_LIBRARY,
  resolveGarmentKey,
  type GarmentKey,
} from "./garment-library.ts";
export type FashionIntent = {
  style: string;
  garment: GarmentKey;
  material: string;
  fit: string;
  colours: string[];
  mood: string;
  ageGroup: "kids";
  realism: "roblox";
};
export type OutfitDNA = {
  outfitId: string;
  palette: {
    primary: string;
    shadows: string;
    seams: string;
    accents: string[];
  };
  fabric: {
    weave: string;
    textureScale: number;
    softness: number;
    weight: number;
  };
  lighting: {
    direction: "top-left";
    contrast: "low" | "medium" | "high";
    shadowIntensity: number;
  };
  stitchStyle: string;
  foldIntensity: number;
  materialRoughness: number;
  graphicStyle: string;
  seed: string;
};
const COLOURS: Record<string, string> = {
  white: "#FFFFFF",
  black: "#171717",
  blue: "#315EAE",
  red: "#B9343C",
  green: "#39735A",
  pink: "#E58BA8",
  purple: "#7654A8",
  yellow: "#E8C84A",
  orange: "#D97935",
  grey: "#80848A",
  gray: "#80848A",
};
function shade(hex: string, factor: number) {
  const n = parseInt(hex.slice(1), 16);
  return `#${[n >> 16, (n >> 8) & 255, n & 255]
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c * factor)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();
}
/** Safe deterministic fallback and normalizer for Stage 1 semantic intent. */
export function understandFashionIntent(prompt: string): FashionIntent {
  const lower = prompt.toLowerCase(),
    garment = resolveGarmentKey(lower),
    template = GARMENT_LIBRARY[garment];
  const colours = Object.keys(COLOURS).filter((c) =>
    new RegExp(`\\b${c}\\b`).test(lower),
  );
  return {
    style: /sport|football/.test(lower) ? "sport" : "streetwear",
    garment,
    material: template.defaultMaterial,
    fit: /oversize|baggy|relaxed/.test(lower) ? "relaxed" : "regular",
    colours: colours.length ? colours : ["white"],
    mood: /dirty|grunge/.test(lower) ? "distressed" : "clean",
    ageGroup: "kids",
    realism: "roblox",
  };
}
/** Stage 2 freezes all cross-garment visual decisions into one immutable record. */
export function planOutfitDNA(
  intent: FashionIntent,
  outfitId = randomUUID(),
): OutfitDNA {
  const primary = COLOURS[intent.colours[0]] ?? "#FFFFFF",
    heavy = /fleece|denim|canvas/.test(intent.material);
  const seed = createHash("sha256")
    .update(JSON.stringify(intent))
    .digest("hex")
    .slice(0, 16);
  return {
    outfitId,
    palette: {
      primary,
      shadows: shade(primary, 0.84),
      seams: shade(primary, 0.76),
      accents: intent.colours
        .slice(1)
        .map((c) => COLOURS[c])
        .filter(Boolean),
    },
    fabric: {
      weave: intent.material,
      textureScale: heavy ? 0.45 : 0.35,
      softness: /fleece|jersey/.test(intent.material) ? 0.82 : 0.48,
      weight: heavy ? 0.8 : 0.45,
    },
    lighting: {
      direction: "top-left",
      contrast: "medium",
      shadowIntensity: 0.34,
    },
    stitchStyle: heavy ? "double-needle tonal" : "fine tonal",
    foldIntensity: GARMENT_LIBRARY[intent.garment].foldPreset.intensity,
    materialRoughness: /mesh/.test(intent.material) ? 0.58 : 0.82,
    graphicStyle: "print follows fabric grain",
    seed,
  };
}
