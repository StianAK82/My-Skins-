import type { ClassicGarment } from "./classic-atlas";
import type { GarmentClassification } from "@workspace/integrations-openai-ai-server";

export interface EnhancedGarmentSpecification {
  garmentType: string;
  material: string;
  primaryColours: string[];
  secondaryColours: string[];
  constructionDetails: string[];
  decorativeDetails: string[];
  visibleText: string | null;
  realismInstructions: string[];
  fit: string;
  front: string[];
  back: string[];
  sleeves: string[];
  legs: string[];
  colourProfile: { primary: string[]; accent: string[] };
}

const MATERIAL_RULES: Array<{ names: string[]; name: string; instructions: string[] }> = [
  { names: ["distressed denim"], name: "distressed denim", instructions: ["pronounced diagonal denim twill", "matte indigo highlights", "stiff angular folds", "heavy topstitching and felled seams", "riveted pocket construction", "controlled whiskering, faded seam edges and small localized abrasion"] },
  { names: ["heavy cotton", "heavyweight cotton"], name: "heavyweight cotton", instructions: ["dense visible cotton weave", "broad matte highlights", "weighty rounded folds", "double-needle stitching", "reinforced shoulder and side seams", "gentle high-point fading without dirt"] },
  { names: ["brushed cotton"], name: "brushed cotton", instructions: ["fine soft raised nap", "diffuse low-contrast light response", "relaxed soft folds", "neat lockstitching", "flat-felled or bound seams", "subtle wear at cuffs and edges"] },
  { names: ["bomber fabric", "bomber"], name: "bomber nylon", instructions: ["tight smooth nylon weave", "controlled satin sheen", "springy rounded creases", "precise tonal stitching", "lined panel construction with rib-knit edges", "light compression marks at seams"] },
  { names: ["puffer fabric", "puffer", "winter jacket"], name: "quilted puffer nylon", instructions: ["fine technical shell weave", "soft directional sheen", "inflated folds constrained by quilting", "tight channel stitching", "even insulated baffles and reinforced openings", "clean lightly compressed baffle edges"] },
  { names: ["sports mesh", "football jersey", "jersey", "tracksuit"], name: "sports mesh", instructions: ["fine breathable perforated knit", "subtle synthetic highlights", "light flowing folds", "flatlock athletic stitching", "ventilated panels and bound openings", "clean performance finish with no distressing"] },
  { names: ["cargo fabric", "cargo", "canvas"], name: "cargo canvas", instructions: ["sturdy basket weave", "dry matte light response", "structured creases at articulation points", "reinforced double stitching", "gussets, flap pockets and reinforced knee or seat panels", "restrained edge softening without grime"] },
  { names: ["suede"], name: "suede", instructions: ["short directional nap", "soft velvety tonal shifts", "supple broad folds", "recessed tonal stitching", "clean panel seams with reinforced edges", "subtle nap variation at handled edges"] },
  { names: ["leather"], name: "leather", instructions: ["fine irregular hide grain", "narrow controlled highlights rather than plastic gloss", "structured folds with gentle creasing", "strong recessed topstitching", "shaped panels and reinforced stress seams", "restrained edge burnishing"] },
  { names: ["silk"], name: "silk", instructions: ["fine smooth weave", "soft directional lustre", "fluid narrow folds", "very fine tonal stitching", "French or finely finished seams", "pristine surface with minimal wear"] },
  { names: ["wool"], name: "wool", instructions: ["dense softly fibrous surface", "diffuse matte shading", "heavy tailored folds", "subtle tonal stitching", "pressed seams, shaped darts and structured panels", "light natural surface variation without pilling"] },
  { names: ["knit", "crewneck"], name: "knit", instructions: ["clearly scaled knitted loops", "soft diffuse highlights", "elastic draping and compression folds", "linked or overlocked seams", "rib-knit collar, cuffs and hem", "clean gentle edge wear"] },
  { names: ["nylon"], name: "nylon", instructions: ["tight technical weave", "restrained directional sheen", "crisp lightweight creases", "fine precise stitching", "taped or bound panel seams", "clean finish with slight seam compression"] },
  { names: ["denim", "jeans", "denim jacket"], name: "denim", instructions: ["visible diagonal twill grain", "matte indigo tonal response", "stiff folds and tension whiskers", "contrast double topstitching", "felled seams, yokes and reinforced pocket edges", "subtle seam fading and edge wear without dirt"] },
  { names: ["cotton", "t-shirt", "tee", "polo", "dress shirt", "flannel", "hoodie", "joggers", "shorts"], name: "cotton", instructions: ["visible fine woven or jersey cotton texture", "matte natural highlights", "soft gravity-driven folds", "even double-needle stitching", "properly finished hems and joined panels", "subtle high-point fading without stains"] },
];

const GARMENT_RULES: Array<{ names: string[]; name: string; details: string[] }> = [
  { names: ["zip hoodie", "zip-up hoodie"], name: "zip hoodie", details: ["full front zipper with tape and topstitched opening", "two separate front pockets", "two-piece hood joined at the center-back", "hood opening, drawcord channel, ribbed cuffs and ribbed hem", "rear hood and shoulder-seam continuation"] },
  { names: ["oversized hoodie"], name: "oversized hoodie", details: ["dropped shoulder seams", "roomy sleeves with compressed ribbed cuffs", "large integrated kangaroo pocket", "two-piece hood with drawcord channel", "broad body folds and a ribbed hem"] },
  { names: ["hoodie"], name: "hoodie", details: ["integrated kangaroo pocket with topstitched openings", "two-piece hood joined at the center-back", "hood opening and drawcord channel", "ribbed cuffs and ribbed hem", "shoulder, side and rear hood seams"] },
  { names: ["crewneck", "sweatshirt"], name: "crewneck", details: ["rib-knit crew collar", "shoulder seam and optional collar V-insert", "ribbed cuffs and waistband", "double-needle armhole and hem stitching", "uninterrupted rear body panel"] },
  { names: ["t-shirt", "tee shirt", "tee"], name: "t-shirt", details: ["rib-bound crew neck", "set-in sleeves", "shoulder and side seams", "double-needle sleeve and lower hems", "natural drape from collar and underarms"] },
  { names: ["polo"], name: "polo", details: ["structured knit collar", "reinforced button placket", "set-in sleeves with finished cuffs", "side seams and vented hem", "clean rear yoke or uninterrupted back panel"] },
  { names: ["dress shirt"], name: "dress shirt", details: ["structured collar with collar stand", "button placket and aligned buttons", "shaped front panels", "rear yoke and restrained back pleat", "cuffs, sleeve plackets and neatly pressed seams"] },
  { names: ["flannel"], name: "flannel shirt", details: ["matched woven check across joined panels", "structured collar and button placket", "chest pocket aligned to the fabric pattern", "rear yoke", "cuffs and double-stitched side seams"] },
  { names: ["denim jacket"], name: "denim jacket", details: ["buttoned front placket", "chest pockets with shaped flaps", "vertical front seams and waistband tabs", "rear yoke and distinct back panel seams", "contrast topstitching continued through sleeves"] },
  { names: ["varsity jacket"], name: "varsity jacket", details: ["striped rib-knit collar, cuffs and waistband", "snap-button front", "welt pockets", "contrasting set-in sleeves", "rear shoulder and body panels distinct from the front"] },
  { names: ["bomber jacket", "bomber"], name: "bomber jacket", details: ["center-front zipper", "rib-knit collar, cuffs and waistband", "angled welt pockets", "shaped sleeve and body panels", "clean lined back with shoulder seam continuation"] },
  { names: ["winter jacket", "puffer"], name: "winter jacket", details: ["insulated quilted baffles", "center-front closure", "high structured collar or joined hood", "zippered or welt pockets", "rear baffles aligned but not copied from the front"] },
  { names: ["denim jacket", "jacket"], name: "jacket", details: ["structured center-front opening", "constructed collar", "shaped front panels and functional pockets", "distinct rear yoke or back seams", "finished cuffs and waistband or hem"] },
  { names: ["tracksuit", "track jacket"], name: "tracksuit", details: ["center-front zipper", "stand collar", "athletic side panels or stripes continued around limbs", "zip or welt pockets", "elasticated cuffs and waistband"] },
  { names: ["football jersey", "jersey"], name: "football jersey", details: ["bound V-neck or crew neckline", "breathable shoulder and side panels", "reinforced sleeve openings", "front chest details separated from rear name-number area", "athletic hem and flatlock seams"] },
  { names: ["cargo trousers", "cargo pants", "cargo"], name: "cargo trousers", details: ["constructed waistband with belt loops", "front fly and shaped front pockets", "gusseted cargo pockets with secured flaps", "reinforced knee panels", "rear yoke, rear pockets and continuous side seams"] },
  { names: ["jeans"], name: "jeans", details: ["constructed waistband and belt loops", "front fly, curved front pockets and coin pocket", "rear yoke and shaped back pockets", "double topstitched side and inseams", "articulated tension folds at hips and knees"] },
  { names: ["joggers"], name: "joggers", details: ["elasticated ribbed waistband with drawcord channel", "slanted front pockets", "tapered leg panels", "ribbed ankle cuffs", "continuous side and inseam construction with rear seat shaping"] },
  { names: ["shorts"], name: "shorts", details: ["constructed waistband", "front opening or drawcord channel", "functional front pockets", "distinct front and rear panels", "finished leg openings and continuous side seams"] },
];

const COLOURS = ["pastel pink", "dark grey", "dark gray", "dark brown", "white", "black", "grey", "gray", "red", "blue", "green", "pink", "purple", "orange", "yellow", "brown", "silver", "gold"];
const CONSTRUCTION = ["pockets", "pocket", "seams", "stitching", "zipper", "buttons", "collar", "hood", "drawstrings", "cuffs", "waistband", "belt loops", "panels", "reinforced knees"];

function uniqueMatches(description: string, terms: string[]): string[] {
  const lower = description.toLowerCase();
  return terms.filter((term) => lower.includes(term)).filter((term, index, all) => !all.some((other, i) => i < index && other.includes(term)));
}

export function enhanceGarmentPrompt(type: ClassicGarment, description: string, classification?: GarmentClassification): EnhancedGarmentSpecification {
  const classifiedTerms = [classification?.garmentType, classification?.material].filter(Boolean).join(" ");
  const lower = `${description} ${classifiedTerms}`.toLowerCase();
  const materialRule = MATERIAL_RULES.find((rule) => rule.names.some((name) => lower.includes(name)));
  const garmentRule = GARMENT_RULES.find((rule) => rule.names.some((name) => lower.includes(name)));
  const detectedColours = uniqueMatches(description, COLOURS);
  const primaryColours = (classification?.primaryColours.length ? classification.primaryColours : detectedColours.slice(0, 2)).filter((value, index, all) => all.indexOf(value) === index);
  const secondaryColours = [...(classification?.accentColours ?? []), ...detectedColours.filter((colour) => !primaryColours.includes(colour))].filter((value, index, all) => all.indexOf(value) === index);
  const textMatch = description.match(/(?:number\s+)(\d{1,3})\s+on\s+the\s+(back|chest|front)\b/i)
    ?? description.match(/"([^"]{1,20})"\s+on\s+the\s+(back|chest|front)\b/i)
    ?? description.match(/\b([A-Z][A-Z ]{0,19})\s+on\s+the\s+(back|chest|front)\b/)
    ?? description.match(/\b([\w-]{1,20})\s+on\s+the\s+(back|chest|front)\b/i);
  const visibleText = textMatch ? `"${textMatch[1].trim()}" on the ${textMatch[2].toLowerCase()}` : null;
  const defaults = type === "shirt"
    ? ["distinct constructed front and rear body panels", "left and right sleeve panels joined naturally at shoulders and underarms", "continuous side, shoulder and armhole seams"]
    : ["constructed waistband and distinct front and rear hip panels", "separate articulated front and rear leg panels", "continuous side seams and inseams"];
  const garmentType = classification?.garmentType || garmentRule?.name || (type === "shirt" ? "constructed shirt or top" : "constructed trousers or pants");
  const constructionDetails = [...(classification?.explicitDetails ?? []), ...uniqueMatches(description, CONSTRUCTION), ...defaults, ...(garmentRule?.details ?? [])].filter((value, index, all) => all.indexOf(value) === index);
  const decorativeDetails = [...uniqueMatches(description, ["dragon", "heart", "graphic", "embroidered", "stripes"]), ...(classification?.artwork ?? [])].filter((value, index, all) => all.indexOf(value) === index);
  return {
    garmentType,
    material: materialRule?.name ?? "woven clothing fabric",
    primaryColours,
    secondaryColours,
    constructionDetails,
    decorativeDetails,
    visibleText,
    realismInstructions: materialRule?.instructions ?? ["visible woven surface", "matte material-aware highlights", "gravity-driven folds and fabric tension", "precise construction stitching", "properly joined and finished panels", "subtle tonal wear without dirt"],
    fit: classification?.fit || (lower.includes("oversized") ? "oversized" : "standard"),
    front: constructionDetails.filter((detail) => /front|pocket|zipper|placket|fly|button|drawcord/i.test(detail)),
    back: constructionDetails.filter((detail) => /back|rear|yoke|hood|shoulder/i.test(detail)),
    sleeves: type === "shirt" ? constructionDetails.filter((detail) => /sleeve|cuff|arm|shoulder/i.test(detail)) : [],
    legs: type === "pants" ? constructionDetails.filter((detail) => /leg|knee|inseam|ankle/i.test(detail)) : [],
    colourProfile: { primary: primaryColours, accent: secondaryColours },
  };
}

export function formatEnhancedPrompt(spec: EnhancedGarmentSpecification): string {
  return [`GARMENT: ${spec.garmentType}; FIT: ${spec.fit}.`, `MATERIAL: ${spec.material}; ${spec.realismInstructions.join("; ")}.`, `COLOUR: ${spec.primaryColours.join(", ") || "exactly as requested"}${spec.secondaryColours.length ? ` with ${spec.secondaryColours.join(", ")}` : ""}; use subtle tonal variation, material highlights, structural shadows, restrained fading, stitch contrast and clean edge wear instead of flat fills.`, `FRONT: ${spec.front.join("; ") || "clean front construction"}.`, `BACK: ${spec.back.join("; ") || "credible distinct rear construction"}.`, spec.sleeves.length ? `SLEEVES: ${spec.sleeves.join("; ")}.` : "", spec.legs.length ? `LEGS: ${spec.legs.join("; ")}.` : "", `CONSTRUCTION: ${spec.constructionDetails.join("; ")}.`, spec.decorativeDetails.length ? `SURFACE ARTWORK: ${spec.decorativeDetails.join(", ")}; integrate it as ink or embroidery following fabric grain, folds and panel boundaries.` : "", spec.visibleText ? `EXACT VISIBLE TEXT: ${spec.visibleText}.` : "NO VISIBLE TEXT."].filter(Boolean).join("\n");
}
