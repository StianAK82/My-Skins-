import type { ClassicGarment } from "./classic-texture.service";

export interface EnhancedGarmentSpecification {
  garmentType: string;
  material: string;
  primaryColours: string[];
  secondaryColours: string[];
  constructionDetails: string[];
  decorativeDetails: string[];
  visibleText: string | null;
  realismInstructions: string[];
}

const MATERIAL_RULES: Record<string, string[]> = {
  cotton: ["soft woven texture", "subtle natural wrinkles", "soft shading"],
  denim: ["visible denim grain", "reinforced seams", "contrast stitching", "slight fading where appropriate"],
  knit: ["visible knitted surface", "ribbed collar and cuffs", "soft folds"],
  leather: ["subtle leather grain", "structured seams", "controlled highlights", "avoid a plastic appearance"],
  "sports fabric": ["lightweight synthetic texture", "breathable panel impression", "clean seams", "controlled highlights"],
  "cargo fabric": ["sturdy woven texture", "reinforced stitching", "utility pockets", "knee construction"],
};
const COLOURS = ["pastel pink", "dark grey", "dark gray", "dark brown", "white", "black", "grey", "gray", "red", "blue", "green", "pink", "purple", "orange", "yellow", "brown", "silver", "gold"];
const CONSTRUCTION = ["pockets", "pocket", "seams", "stitching", "zipper", "buttons", "collar", "hood", "drawstrings", "cuffs", "waistband", "belt loops", "panels", "reinforced knees"];

function uniqueMatches(description: string, terms: string[]): string[] {
  const lower = description.toLowerCase();
  return terms.filter((term) => lower.includes(term)).filter((term, index, all) => !all.some((other, i) => i < index && other.includes(term)));
}

export function enhanceGarmentPrompt(type: ClassicGarment, description: string): EnhancedGarmentSpecification {
  const lower = description.toLowerCase();
  const material = lower.includes("denim") ? "denim" : lower.includes("knit") ? "knit" : lower.includes("leather") ? "leather" :
    /(football|jersey|tracksuit|sports fabric)/.test(lower) ? "sports fabric" : lower.includes("cargo") ? "cargo fabric" : lower.includes("cotton") ? "cotton" : "woven clothing fabric";
  const colours = uniqueMatches(description, COLOURS);
  const textMatch = description.match(/(?:number\s+)(\d{1,3})\s+on\s+the\s+(back|chest|front)\b/i)
    ?? description.match(/"([^"]{1,20})"\s+on\s+the\s+(back|chest|front)\b/i)
    ?? description.match(/\b([A-Z][A-Z ]{0,19})\s+on\s+the\s+(back|chest|front)\b/)
    ?? description.match(/\b([\w-]{1,20})\s+on\s+the\s+(back|chest|front)\b/i);
  const visibleText = textMatch ? `"${textMatch[1].trim()}" on the ${textMatch[2].toLowerCase()}` : null;
  const graphicMatches = uniqueMatches(description, ["dragon", "heart", "graphic", "embroidered", "stripes"]);
  const defaults = type === "shirt" ? ["coherent front and back panels", "properly joined sleeve panels", "visible garment seams"] : ["constructed waistband and hip panels", "distinct front and back leg panels", "visible garment seams"];
  if (lower.includes("hoodie")) defaults.push("structured hood", "hood drawstrings", "ribbed cuffs", "kangaroo-style front pockets");
  if (lower.includes("jacket")) defaults.push("structured front opening", "constructed collar", "finished cuffs");
  return {
    garmentType: `${type === "shirt" ? "Classic shirt/top" : "Classic pants/trousers"}: ${description.split(/\s+/).slice(0, 5).join(" ")}`,
    material,
    primaryColours: colours.slice(0, 2),
    secondaryColours: colours.slice(2),
    constructionDetails: [...uniqueMatches(description, CONSTRUCTION), ...defaults].filter((v, i, a) => a.indexOf(v) === i),
    decorativeDetails: graphicMatches,
    visibleText,
    realismInstructions: MATERIAL_RULES[material] ?? ["believable fabric surface", "natural folds", "soft structural shadows", "subtle stitching"],
  };
}

export function formatEnhancedPrompt(spec: EnhancedGarmentSpecification): string {
  return [`${spec.garmentType} made from ${spec.material}.`, `Primary colours: ${spec.primaryColours.join(", ") || "as requested"}.`,
    spec.secondaryColours.length ? `Secondary colours: ${spec.secondaryColours.join(", ")}.` : "", `Construction: ${spec.constructionDetails.join(", ")}.`,
    spec.decorativeDetails.length ? `Requested decoration: ${spec.decorativeDetails.join(", ")}.` : "", spec.visibleText ? `Exact visible text: ${spec.visibleText}.` : "No visible text.",
    `Realism: ${spec.realismInstructions.join(", ")}.`].filter(Boolean).join(" ");
}
