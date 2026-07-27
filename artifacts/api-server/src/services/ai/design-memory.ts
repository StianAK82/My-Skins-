import type { ClassicGarment } from "./classic-atlas";

export const DESIGN_ISSUES = [
  "insufficient_texture",
  "front_copied_to_back",
  "flat_material",
  "broken_panel_continuity",
  "weak_construction",
] as const;
export type DesignIssue = (typeof DESIGN_ISSUES)[number];

type MemoryRule = { key: string; names: string[]; practices: string[] };
type StyleRule = { key: string; names: string[]; traits: string[] };

const GARMENTS: MemoryRule[] = [
  {
    key: "oversized-hoodie",
    names: ["oversized hoodie"],
    practices: [
      "rib-knit cuffs and hem",
      "dropped shoulder seams",
      "integrated kangaroo pocket",
      "two-piece hood with center-back seam",
      "rear hood and shoulder continuation",
      "relaxed weight-driven folds",
      "matte heavyweight cotton texture",
    ],
  },
  {
    key: "hoodie",
    names: ["hoodie", "sweater"],
    practices: [
      "rib-knit cuffs and hem",
      "shoulder seams",
      "integrated kangaroo pocket",
      "two-piece hood seam",
      "credible back-of-hood continuation",
      "relaxed folds",
      "matte cotton texture",
    ],
  },
  {
    key: "jeans",
    names: ["jeans", "denim pants", "denim trousers"],
    practices: [
      "constructed waistband",
      "front fly",
      "coin pocket",
      "belt loops",
      "rear yoke",
      "shaped rear pockets",
      "continuous inseam",
      "contrast double topstitching",
      "hip and knee whiskers",
      "visible diagonal denim twill",
    ],
  },
  {
    key: "varsity",
    names: ["varsity", "letterman"],
    practices: [
      "striped rib-knit cuffs and hem",
      "snap buttons",
      "contrasting sleeves",
      "chenille patch when requested",
      "welt pockets",
      "distinct rear body construction",
    ],
  },
  {
    key: "football",
    names: ["football jersey", "soccer jersey"],
    practices: [
      "bound neckline",
      "breathable side panels",
      "reinforced sleeve openings",
      "separate front crest and rear name-number zones",
      "flatlock seams",
      "fine sports-mesh texture",
    ],
  },
  {
    key: "cargo",
    names: ["cargo pants", "cargo trousers", "cargo"],
    practices: [
      "belt-loop waistband",
      "front fly",
      "gusseted cargo pockets",
      "reinforced knee panels",
      "rear pockets and seat shaping",
      "continuous side seams and inseams",
      "matte canvas weave",
    ],
  },
];

const STYLES: StyleRule[] = [
  {
    key: "streetwear",
    names: ["streetwear", "urban"],
    traits: [
      "relaxed contemporary silhouette",
      "confident proportions",
      "clean construction with selective statement details",
    ],
  },
  {
    key: "oversized",
    names: ["oversized", "baggy"],
    traits: [
      "wide silhouette",
      "dropped shoulders where applicable",
      "large gravity-driven folds",
      "room without losing seam structure",
    ],
  },
  {
    key: "modern-minimal",
    names: ["modern minimal", "minimalist", "minimal"],
    traits: [
      "restrained seam language",
      "quiet tonal contrast",
      "precise uncluttered construction",
    ],
  },
  {
    key: "y2k",
    names: ["y2k", "2000s"],
    traits: [
      "early-2000s proportions",
      "purposeful contrast accents",
      "fitted or exaggerated panel shapes",
    ],
  },
  {
    key: "techwear",
    names: ["techwear", "tactical"],
    traits: [
      "functional articulated panels",
      "technical matte fabric",
      "taped seams and utility details",
      "controlled reflective accents",
    ],
  },
  {
    key: "luxury",
    names: ["luxury", "premium", "designer"],
    traits: [
      "refined material response",
      "precise tailoring",
      "restrained high-quality finishing",
    ],
  },
  {
    key: "vintage",
    names: ["vintage", "retro", "washed"],
    traits: [
      "era-aware proportions",
      "controlled seam fading",
      "natural wear without dirt",
    ],
  },
  {
    key: "anime",
    names: ["anime", "manga"],
    traits: [
      "graphic focal hierarchy",
      "clean readable shapes",
      "artwork integrated with panel construction",
    ],
  },
  {
    key: "football",
    names: ["football", "soccer"],
    traits: [
      "athletic fit and mobility",
      "breathable panel logic",
      "clear front-versus-back identity",
    ],
  },
  {
    key: "military",
    names: ["military", "army"],
    traits: [
      "structured utility construction",
      "durable reinforced seams",
      "restrained functional palette",
    ],
  },
  {
    key: "formal",
    names: ["formal", "tailored", "suit"],
    traits: [
      "structured silhouette",
      "pressed seam logic",
      "precise understated finishing",
    ],
  },
];

export interface DesignMemorySelection {
  garmentKey: string;
  garmentPractices: string[];
  styles: Array<{ key: string; traits: string[] }>;
}
export interface DesignFeedback {
  issues: DesignIssue[];
  accepted: boolean;
}

export function retrieveDesignMemory(
  type: ClassicGarment,
  description: string,
): DesignMemorySelection {
  const text = description.toLowerCase();
  const garment = (text.includes("oversized") && text.includes("hoodie")
    ? GARMENTS.find((entry) => entry.key === "oversized-hoodie")
    : undefined) ??
    GARMENTS.find((entry) =>
      entry.names.some((name) => text.includes(name)),
    ) ?? {
      key: type === "shirt" ? "generic-top" : "generic-pants",
      names: [],
      practices:
        type === "shirt"
          ? [
              "finished neckline and hems",
              "credible front and rear construction",
              "continuous shoulder and side seams",
              "material-aware folds and grain",
            ]
          : [
              "constructed waistband",
              "distinct front and rear panels",
              "continuous side seams and inseams",
              "material-aware folds and grain",
            ],
    };
  return {
    garmentKey: garment.key,
    garmentPractices: garment.practices,
    styles: STYLES.filter((style) =>
      style.names.some((name) => text.includes(name)),
    ).map(({ key, traits }) => ({ key, traits })),
  };
}

export function learnedInstructions(feedback: DesignFeedback[]): string[] {
  if (feedback.length < 10) return [];
  const instruction: Record<DesignIssue, string> = {
    insufficient_texture:
      "Increase material texture strength and keep weave or grain visibly scaled on every panel.",
    front_copied_to_back:
      "Strengthen front/back differentiation; reconstruct the rear rather than copying any front feature.",
    flat_material:
      "Increase material depth with restrained tonal variation, contact shading and fabric-specific highlights.",
    broken_panel_continuity:
      "Strengthen panel continuity across UV boundaries, especially shoulders, sides, hems and limb seams.",
    weak_construction:
      "Increase tailoring detail: functional openings, joined panels, edge finishing and appropriate topstitching.",
  };
  return DESIGN_ISSUES.filter(
    (issue) =>
      feedback.filter((item) => item.issues.includes(issue)).length /
        feedback.length >=
      0.3,
  ).map((issue) => instruction[issue]);
}
