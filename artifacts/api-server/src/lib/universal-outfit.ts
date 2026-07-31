import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  constructionDetailsFor,
  validateFashionConstruction,
} from "./fashion-construction-validator";

const hex = z.string().regex(/^#[0-9A-F]{6}$/);
const capability = z.enum(["supported", "preview_only", "unsupported"]);
const category = z.enum([
  "top",
  "bottom",
  "one_piece",
  "footwear",
  "hair",
  "accessory",
]);
const size = z.enum(["small", "medium", "large"]);

export const outfitItemSchema = z
  .object({
    id: z
      .string()
      .regex(/^(top|bottom|one-piece|footwear|hair|accessory)-[a-z0-9-]+$/),
    category,
    kind: z.string().min(1),
    label: z.string().min(1),
    colors: z.array(hex).min(1),
    fit: z.enum(["slim", "regular", "relaxed", "oversized"]),
    silhouette: z.string().min(1),
    material: z.string().min(1),
    constructionDetails: z.array(z.string()),
    decorativeDetails: z.array(z.string()),
    size,
    placement: z.string().min(1),
    layeringOrder: z.number().int().min(0),
    relationships: z.array(
      z.object({
        type: z.enum(["paired_with", "replaces", "attached_to"]),
        targetId: z.string(),
      }),
    ),
    previewCapability: capability,
    exportCapability: z.enum(["classic_shirt", "classic_pants", "none"]),
    fallback: z.object({
      state: z.enum(["none", "used", "unavailable"]),
      message: z.string().nullable(),
    }),
    unsupported: z.object({
      state: z.boolean(),
      reason: z.string().nullable(),
    }),
  })
  .strict();

const evidence = z.object({
  validator: z.string(),
  passed: z.boolean(),
  reasons: z.array(z.string()),
});
const qualityDimensions = [
  "promptFaithfulness",
  "itemCompleteness",
  "colorCorrectness",
  "silhouetteQuality",
  "proportionQuality",
  "layeringQuality",
  "materialCoherence",
  "constructionDetail",
  "styleCoherence",
  "accessoryPlacement",
  "collisionRisk",
  "previewStability",
  "exportValidity",
  "childAppeal",
  "revisionPreservation",
] as const;
const dimensionShape = Object.fromEntries(
  qualityDimensions.map((key) => [key, z.number().min(0).max(100)]),
) as Record<(typeof qualityDimensions)[number], z.ZodNumber>;

export const universalOutfitSpecSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    generationId: z.string().uuid(),
    promptLanguage: z.enum(["en", "no", "unknown"]),
    normalizedUserIntent: z.string().min(1),
    styleDirection: z.string().min(1),
    colorPalette: z.array(hex).min(1),
    items: z.array(outfitItemSchema),
    onePieceBehavior: z.enum(["not_applicable", "replaces_top_and_bottom"]),
    safetyState: z.enum(["pending", "approved", "blocked", "modified"]),
    rightsState: z.enum(["pending", "approved", "restricted"]),
    moderationState: z.enum(["pending", "approved", "quarantined", "rejected"]),
    revisionHistory: z.array(
      z.object({
        revisionId: z.string(),
        instructionHash: z.string(),
        changedPaths: z.array(z.string()),
        createdAt: z.string().datetime(),
      }),
    ),
    validationEvidence: z.array(evidence),
    quality: z.object({
      score: z.number().min(0).max(100),
      threshold: z.number().min(0).max(100),
      accepted: z.boolean(),
      dimensions: z.object(dimensionShape),
      failureReasons: z.array(z.string()),
    }),
    repairHistory: z.array(
      z.object({
        attempt: z.number().int().positive(),
        changedPaths: z.array(z.string()),
        previousScore: z.number(),
        resultingScore: z.number(),
      }),
    ),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const ids = new Set<string>();
    for (const [index, item] of spec.items.entries()) {
      if (ids.has(item.id))
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "id"],
          message: "stable item IDs must be unique",
        });
      ids.add(item.id);
    }
    const onePieces = spec.items.filter(
      (item) => item.category === "one_piece" && !item.unsupported.state,
    );
    if (
      onePieces.length &&
      spec.items.some(
        (item) =>
          (item.category === "top" || item.category === "bottom") &&
          !item.unsupported.state,
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "a supported one-piece replaces separate top and bottom items",
      });
    }
    for (const [index, item] of spec.items.entries())
      for (const relation of item.relationships) {
        if (!ids.has(relation.targetId))
          ctx.addIssue({
            code: "custom",
            path: ["items", index, "relationships"],
            message: `relationship target ${relation.targetId} does not exist`,
          });
      }
  });

export type UniversalOutfitSpec = z.infer<typeof universalOutfitSpecSchema>;
export type OutfitItem = z.infer<typeof outfitItemSchema>;
export type QualityDimensions = UniversalOutfitSpec["quality"]["dimensions"];

export const hashPrivateInstruction = (text: string) =>
  createHash("sha256").update(text.normalize("NFKC")).digest("hex");

export function scoreOutfitQuality(
  dimensions: QualityDimensions,
  failureReasons: string[] = [],
  threshold = 78,
) {
  const values = qualityDimensions.map((key) => dimensions[key]);
  const score = Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
  const critical =
    dimensions.exportValidity === 0 || dimensions.previewStability === 0;
  return {
    score,
    threshold,
    accepted: !critical && score >= threshold && failureReasons.length === 0,
    dimensions,
    failureReasons,
  };
}

export type AssetManifest = {
  kind: string;
  category: OutfitItem["category"];
  variants: string[];
  fits: OutfitItem["fit"][];
  sizes: OutfitItem["size"][];
  previewImplementation: string | null;
  classicExport: "shirt" | "pants" | null;
  production3d: null;
  evidence: string[];
  fallback: string | null;
  limitations: string[];
  license: string;
  version: string;
  tests: string[];
};

export const ASSET_REGISTRY: readonly AssetManifest[] = [
  ...[
    "tshirt",
    "hoodie",
    "oversized_hoodie",
    "zip_hoodie",
    "sweatshirt",
    "jacket",
    "bomber_jacket",
    "varsity_jacket",
    "blazer",
    "trench_coat",
    "puffer_jacket",
    "winter_coat",
    "football_jersey",
    "formal_shirt",
    "suit_jacket",
    "kimono",
    "armor",
  ].map((kind) => ({
    kind,
    category: "top" as const,
    variants: ["default"],
    fits: ["regular", "relaxed", "oversized"] as OutfitItem["fit"][],
    sizes: ["small", "medium", "large"] as OutfitItem["size"][],
    previewImplementation: `primitive:${kind}`,
    classicExport: "shirt" as const,
    production3d: null,
    evidence: ["renderer-unit"],
    fallback: null,
    limitations: ["Preview geometry is not production layered clothing"],
    license: "repository-owned",
    version: "1",
    tests: ["universal-outfit.test.ts"],
  })),
  ...["jeans", "joggers", "cargo_pants", "formal_trousers", "shorts"].map(
    (kind) => ({
      kind,
      category: "bottom" as const,
      variants: ["default"],
      fits: ["slim", "regular", "relaxed"] as OutfitItem["fit"][],
      sizes: ["small", "medium", "large"] as OutfitItem["size"][],
      previewImplementation: `primitive:${kind}`,
      classicExport: "pants" as const,
      production3d: null,
      evidence: ["renderer-unit"],
      fallback: null,
      limitations: ["Preview geometry is not production layered clothing"],
      license: "repository-owned",
      version: "1",
      tests: ["universal-outfit.test.ts"],
    }),
  ),
  ...[
    "dress",
    "shoes",
    "boots",
    "cap",
    "beanie",
    "long_hair",
    "short_hair",
    "curly_hair",
    "afro_hair",
    "dreadlocks",
    "ponytail_hair",
    "anime_hair",
    "roblox_hair",
    "backpack",
    "shoulder_bag",
    "wings",
    "crown",
    "mask",
    "belt",
    "helmet",
    "scarf",
    "tail",
    "horns",
    "headphones",
    "necklace",
    "sword",
    "cape",
  ].map((kind) => ({
    kind,
    category: (kind === "dress"
      ? "one_piece"
      : ["shoes", "boots"].includes(kind)
        ? "footwear"
        : kind.includes("hair")
          ? "hair"
          : "accessory") as OutfitItem["category"],
    variants: ["default"],
    fits: ["regular"] as OutfitItem["fit"][],
    sizes: ["small", "medium", "large"] as OutfitItem["size"][],
    previewImplementation: `primitive:${kind}`,
    classicExport: null,
    production3d: null,
    evidence: ["renderer-unit"],
    fallback: null,
    limitations: ["Preview-only"],
    license: "repository-owned",
    version: "1",
    tests: ["universal-outfit.test.ts"],
  })),
];

export function routeAsset(
  item: Pick<OutfitItem, "kind" | "category" | "fit" | "size">,
): {
  state: "resolved" | "unsupported";
  manifest: AssetManifest | null;
  reason: string | null;
} {
  const manifest = ASSET_REGISTRY.find(
    (entry) => entry.kind === item.kind && entry.category === item.category,
  );
  if (!manifest)
    return {
      state: "unsupported",
      manifest: null,
      reason: `No registered implementation for ${item.category}:${item.kind}`,
    };
  if (!manifest.fits.includes(item.fit) || !manifest.sizes.includes(item.size))
    return {
      state: "unsupported",
      manifest,
      reason: `Registered asset does not support ${item.fit}/${item.size}`,
    };
  return { state: "resolved", manifest, reason: null };
}

export function applyRevision(
  spec: UniversalOutfitSpec,
  instruction: string,
  patch: {
    itemId: string;
    field: "size" | "colors";
    value: OutfitItem["size"] | string[];
  },
  now = new Date(),
): UniversalOutfitSpec {
  const index = spec.items.findIndex((item) => item.id === patch.itemId);
  if (index < 0) throw new Error(`Unknown stable item ID: ${patch.itemId}`);
  const copy = structuredClone(spec);
  if (patch.field === "size")
    copy.items[index].size = z
      .enum(["small", "medium", "large"])
      .parse(patch.value);
  else copy.items[index].colors = z.array(hex).min(1).parse(patch.value);
  copy.revisionHistory.push({
    revisionId: randomUUID(),
    instructionHash: hashPrivateInstruction(instruction),
    changedPaths: [`items.${patch.itemId}.${patch.field}`],
    createdAt: now.toISOString(),
  });
  return universalOutfitSpecSchema.parse(copy);
}

export type LegacyOutfitPlan = {
  top: string;
  bottom: string;
  shoes: string;
  shoesColor?: string;
  topDescription?: string;
  bottomDescription?: string;
  hair: { style: string; color: string };
  accessories: Array<{
    kind: string;
    color: string;
    size?: "small" | "medium" | "large";
  }>;
  customParts?: Array<{
    name: string;
    shape: string;
    attach: string;
    color: string;
    size: "small" | "medium" | "large";
  }>;
  unsupported: string[];
  reason: string;
};

const canonicalKind = (category: OutfitItem["category"], kind: string) => {
  if (category === "top")
    return (
      ({ sweater: "tshirt", jacket: "jacket" } as Record<string, string>)[
        kind
      ] ?? kind
    );
  if (category === "bottom")
    return (
      ({ pants: "joggers", skirt: "shorts" } as Record<string, string>)[kind] ??
      kind
    );
  if (category === "footwear") return kind === "sneakers" ? "shoes" : kind;
  if (category === "hair") return kind === "long" ? "long_hair" : "short_hair";
  if (category === "accessory") return kind === "bag" ? "shoulder_bag" : kind;
  return kind;
};

/**
 * @deprecated Compatibility boundary for model output created before UniversalOutfitSpec.
 * Remove when the model prompt emits UniversalOutfitSpec and the final legacy aiOutfitSchema
 * fixture/persisted generation has passed its retention deadline. Product code must consume
 * only the returned UniversalOutfitSpec.
 */
export function legacyToUniversalOutfitSpec(input: {
  generationId: string;
  prompt: string;
  language?: "en" | "no" | "unknown";
  style: string;
  palette: string[];
  outfit: LegacyOutfitPlan;
  faithfulness?: { score: number; issues: string[] };
  repairHistory?: UniversalOutfitSpec["repairHistory"];
}): UniversalOutfitSpec {
  const items: OutfitItem[] = [];
  const add = (
    category: OutfitItem["category"],
    rawKind: string,
    color: string,
    size: OutfitItem["size"] = "medium",
    label = rawKind,
  ) => {
    const kind = canonicalKind(category, rawKind);
    const idPrefix = category === "one_piece" ? "one-piece" : category;
    const id = `${idPrefix}-${kind.replaceAll("_", "-")}-${String(items.filter((i) => i.category === category).length + 1).padStart(2, "0")}`;
    const route = routeAsset({ kind, category, fit: "regular", size });
    const supported = route.state === "resolved";
    items.push({
      id,
      category,
      kind,
      label,
      colors: [color.toUpperCase()],
      fit: "regular",
      silhouette: kind,
      material: category === "footwear" ? "synthetic" : "fabric",
      constructionDetails: constructionDetailsFor(kind),
      decorativeDetails: [],
      size,
      placement:
        category === "top" || category === "one_piece"
          ? "torso"
          : category === "bottom"
            ? "legs"
            : category === "footwear"
              ? "feet"
              : category === "hair"
                ? "head"
                : "body",
      layeringOrder: items.length,
      relationships: [],
      previewCapability: supported ? "supported" : "unsupported",
      exportCapability:
        supported && category === "top"
          ? "classic_shirt"
          : supported && category === "bottom"
            ? "classic_pants"
            : "none",
      fallback: {
        state: supported ? "none" : "unavailable",
        message: route.reason,
      },
      unsupported: { state: !supported, reason: route.reason },
    });
  };
  const color = (input.palette[0] ?? "#808080").toUpperCase();
  const onePiece = input.outfit.top === "dress";
  if (onePiece) add("one_piece", "dress", color);
  else {
    if (input.outfit.top !== "none") add("top", input.outfit.top, color);
    if (input.outfit.bottom !== "none")
      add("bottom", input.outfit.bottom, input.palette[1] ?? color);
  }
  if (input.outfit.shoes !== "none")
    add("footwear", input.outfit.shoes, input.outfit.shoesColor ?? color);
  if (input.outfit.hair.style !== "none")
    add("hair", input.outfit.hair.style, input.outfit.hair.color);
  for (const a of input.outfit.accessories)
    add("accessory", a.kind, a.color, a.size ?? "medium");
  for (const part of input.outfit.customParts ?? [])
    add("accessory", part.shape, part.color, part.size, part.name);
  for (const label of input.outfit.unsupported)
    add("accessory", `unsupported-${items.length + 1}`, color, "medium", label);
  const routeFailures = items
    .filter((i) => i.unsupported.state)
    .map((i) => i.unsupported.reason ?? `${i.label} is unsupported`);
  const faithfulnessFailures = input.faithfulness?.issues ?? [];
  const construction = validateFashionConstruction(items);
  const failures = [
    ...routeFailures,
    ...faithfulnessFailures,
    ...construction.reasons,
  ];
  const resolved = items.filter((i) => !i.unsupported.state);
  const base = routeFailures.length ? 70 : 94;
  const dimensions = Object.fromEntries(
    qualityDimensions.map((k) => [k, base]),
  ) as QualityDimensions;
  dimensions.promptFaithfulness = input.faithfulness?.score ?? base;
  dimensions.itemCompleteness = input.faithfulness?.score ?? base;
  dimensions.colorCorrectness = input.faithfulness?.score ?? base;
  dimensions.constructionDetail = construction.score;
  if (!resolved.length) dimensions.previewStability = 0;
  const quality = scoreOutfitQuality(dimensions, failures);
  return universalOutfitSpecSchema.parse({
    schemaVersion: "1.0",
    generationId: input.generationId,
    promptLanguage:
      input.language ??
      (/\b(og|med|gjør|bare|vingene|sekken)\b/i.test(input.prompt)
        ? "no"
        : "en"),
    normalizedUserIntent: input.prompt.normalize("NFKC").trim(),
    styleDirection: input.style,
    colorPalette: input.palette.map((c) => c.toUpperCase()),
    items,
    onePieceBehavior: onePiece ? "replaces_top_and_bottom" : "not_applicable",
    safetyState: "approved",
    rightsState: "pending",
    moderationState: "approved",
    revisionHistory: [],
    validationEvidence: [
      { validator: "universal-outfit-schema", passed: true, reasons: [] },
      {
        validator: "asset-router",
        passed: routeFailures.length === 0,
        reasons: routeFailures,
      },
      {
        validator: "prompt-faithfulness",
        passed: faithfulnessFailures.length === 0,
        reasons: faithfulnessFailures,
      },
      {
        validator: "fashion-construction",
        passed: construction.passed,
        reasons: construction.reasons,
      },
      {
        validator: "quality-gate",
        passed: quality.accepted,
        reasons: quality.failureReasons,
      },
    ],
    quality,
    repairHistory: input.repairHistory ?? [],
  });
}

export type PreviewSceneSpec = {
  generationId: string;
  registryVersion: string;
  items: Array<{
    itemId: string;
    kind: string;
    category: OutfitItem["category"];
    color: string;
    size: OutfitItem["size"];
    implementation: string;
  }>;
};
export function toPreviewSceneSpec(
  spec: UniversalOutfitSpec,
): PreviewSceneSpec {
  const parsed = universalOutfitSpecSchema.parse(spec);
  return {
    generationId: parsed.generationId,
    registryVersion: "1",
    items: parsed.items.flatMap((item) => {
      const routed = routeAsset(item);
      return routed.state === "resolved" &&
        routed.manifest?.previewImplementation
        ? [
            {
              itemId: item.id,
              kind: item.kind,
              category: item.category,
              color: item.colors[0],
              size: item.size,
              implementation: routed.manifest.previewImplementation,
            },
          ]
        : [];
    }),
  };
}

export const modelOutfitItemsSchema = z
  .array(
    z
      .object({
        id: z
          .string()
          .regex(/^(top|bottom|one-piece|footwear|hair|accessory)-[a-z0-9-]+$/),
        category,
        kind: z.string().min(1),
        label: z.string().min(1),
        color: hex,
        fit: z.enum(["slim", "regular", "relaxed", "oversized"]),
        size,
        material: z.string().min(1),
        placement: z.string().min(1),
      })
      .strict(),
  )
  .max(24);
type CanonicalRequirement = { id: string; kinds: string[] };

/** Model-independent check that prevents generic garments from replacing exact wishes. */
export function evaluateCanonicalItemFaithfulness(
  prompt: string,
  items: ReadonlyArray<{ kind: string }>,
) {
  const text = prompt.normalize("NFKC").toLocaleLowerCase("nb-NO");
  const rules: Array<[RegExp, CanonicalRequirement]> = [
    [
      /\b(zip(?:-?up)? hoodie|glidel[aå]shettegenser)\b/u,
      { id: "zip hoodie", kinds: ["zip_hoodie"] },
    ],
    [
      /\b(oversized hoodie|oversized hettegenser)\b/u,
      { id: "oversized hoodie", kinds: ["oversized_hoodie"] },
    ],
    [
      /\b(hoodie|hette\s?genser)\b/u,
      { id: "hoodie", kinds: ["hoodie", "zip_hoodie", "oversized_hoodie"] },
    ],
    [
      /\b(sweatshirt|collegegenser)\b/u,
      { id: "sweatshirt", kinds: ["sweatshirt"] },
    ],
    [
      /\b(bomber(?:jakke| jacket)?)\b/u,
      { id: "bomber", kinds: ["bomber_jacket"] },
    ],
    [
      /\b(varsity(?:jakke| jacket)?)\b/u,
      { id: "varsity jacket", kinds: ["varsity_jacket"] },
    ],
    [/\b(blazer)\b/u, { id: "blazer", kinds: ["blazer"] }],
    [
      /\b(trench(?:coat)?|grøftfrakk)\b/u,
      { id: "trench coat", kinds: ["trench_coat"] },
    ],
    [
      /\b(puffer|boblejakke)\b/u,
      { id: "puffer jacket", kinds: ["puffer_jacket"] },
    ],
    [
      /\b(fotballdrakt|football (?:kit|jersey))\b/u,
      { id: "football jersey", kinds: ["football_jersey"] },
    ],
    [/\b(kimono)\b/u, { id: "kimono", kinds: ["kimono"] }],
    [/\b(rustning|armo[u]?r)\b/u, { id: "armor", kinds: ["armor"] }],
    [
      /\b(cargo(?:-?bukse| pants| trousers)?|cargobukse)\b/u,
      { id: "cargo pants", kinds: ["cargo_pants"] },
    ],
    [/\b(jeans|olabukse)\b/u, { id: "jeans", kinds: ["jeans"] }],
    [/\b(joggers|joggebukse)\b/u, { id: "joggers", kinds: ["joggers"] }],
    [/\b(shorts|kortbukse)\b/u, { id: "shorts", kinds: ["shorts"] }],
    [/\b(sneakers|snikkers|joggesko)\b/u, { id: "sneakers", kinds: ["shoes"] }],
    [/\b(caps|cap)\b/u, { id: "cap", kinds: ["cap"] }],
    [
      /\b(sølvkjede|silver (?:chain|necklace)|halskjede|necklace)\b/u,
      { id: "necklace", kinds: ["necklace"] },
    ],
    [/\b(vinger|wings)\b/u, { id: "wings", kinds: ["wings"] }],
    [/\b(hjelm|helmet)\b/u, { id: "helmet", kinds: ["helmet"] }],
    [/\b(kappe|cape)\b/u, { id: "cape", kinds: ["cape"] }],
    [/\b(sverd|sword)\b/u, { id: "sword", kinds: ["sword"] }],
  ];
  const requirements = rules
    .filter(([pattern]) => pattern.test(text))
    .map(([, requirement]) => requirement)
    .filter(
      (requirement, index, all) =>
        all.findIndex((entry) => entry.id === requirement.id) === index,
    );
  const itemKinds = new Set(items.map((item) => item.kind));
  const missing = requirements.filter(
    (requirement) => !requirement.kinds.some((kind) => itemKinds.has(kind)),
  );
  return {
    score: requirements.length
      ? Math.round(
          (100 * (requirements.length - missing.length)) / requirements.length,
        )
      : 100,
    requirements: requirements.map((requirement) => requirement.id),
    issues: missing.map(
      (requirement) => `Missing exact requested item: ${requirement.id}`,
    ),
  };
}

/** Builds canonical product state directly from model item output; no legacy outfit participates. */
export function modelItemsToUniversalOutfitSpec(input: {
  generationId: string;
  prompt: string;
  language?: "en" | "no" | "unknown";
  style: string;
  palette: string[];
  items: unknown;
  faithfulness: { score: number; issues: string[] };
  repairHistory: UniversalOutfitSpec["repairHistory"];
}): UniversalOutfitSpec {
  const modelItems = modelOutfitItemsSchema.parse(input.items);
  const seen = new Set<string>();
  const items: OutfitItem[] = modelItems.map((m, index) => {
    if (seen.has(m.id)) throw new Error(`Duplicate model item id: ${m.id}`);
    seen.add(m.id);
    const routed = routeAsset(m);
    const supported = routed.state === "resolved";
    return {
      id: m.id,
      category: m.category,
      kind: m.kind,
      label: m.label,
      colors: [m.color],
      fit: m.fit,
      silhouette: m.kind,
      material: m.material,
      constructionDetails: constructionDetailsFor(m.kind),
      decorativeDetails: [],
      size: m.size,
      placement: m.placement,
      layeringOrder: index,
      relationships: [],
      previewCapability: supported ? "supported" : "unsupported",
      exportCapability:
        supported && m.category === "top"
          ? "classic_shirt"
          : supported && m.category === "bottom"
            ? "classic_pants"
            : "none",
      fallback: {
        state: supported ? "none" : "unavailable",
        message: routed.reason,
      },
      unsupported: { state: !supported, reason: routed.reason },
    };
  });
  const routeFailures = items
    .filter((i) => i.unsupported.state)
    .map((i) => i.unsupported.reason!);
  const canonicalFaithfulness = evaluateCanonicalItemFaithfulness(
    input.prompt,
    items,
  );
  const faithfulnessScore =
    input.faithfulness.score <= 1
      ? Math.round(input.faithfulness.score * 100)
      : input.faithfulness.score;
  const faithfulnessIssues = [
    ...input.faithfulness.issues,
    ...canonicalFaithfulness.issues,
  ];
  const construction = validateFashionConstruction(items);
  const failures = [
    ...routeFailures,
    ...faithfulnessIssues,
    ...construction.reasons,
  ];
  const dimensions = Object.fromEntries(
    qualityDimensions.map((k) => [k, routeFailures.length ? 70 : 94]),
  ) as QualityDimensions;
  dimensions.promptFaithfulness = dimensions.itemCompleteness = Math.min(
    faithfulnessScore,
    canonicalFaithfulness.score,
  );
  dimensions.colorCorrectness = faithfulnessScore;
  dimensions.constructionDetail = construction.score;
  if (!items.some((i) => !i.unsupported.state)) dimensions.previewStability = 0;
  const quality = scoreOutfitQuality(dimensions, failures);
  return universalOutfitSpecSchema.parse({
    schemaVersion: "1.0",
    generationId: input.generationId,
    promptLanguage:
      input.language ??
      (/\b(og|med|gjør|bare)\b/i.test(input.prompt) ? "no" : "en"),
    normalizedUserIntent: input.prompt,
    styleDirection: input.style,
    colorPalette: input.palette,
    items,
    onePieceBehavior: items.some((i) => i.category === "one_piece")
      ? "replaces_top_and_bottom"
      : "not_applicable",
    safetyState: "approved",
    rightsState: "pending",
    moderationState: "approved",
    revisionHistory: [],
    validationEvidence: [
      { validator: "model-item-schema", passed: true, reasons: [] },
      {
        validator: "prompt-faithfulness",
        passed: !faithfulnessIssues.length,
        reasons: faithfulnessIssues,
      },
      {
        validator: "exact-silhouette",
        passed: !canonicalFaithfulness.issues.length,
        reasons: canonicalFaithfulness.issues,
      },
      {
        validator: "asset-router",
        passed: !routeFailures.length,
        reasons: routeFailures,
      },
      {
        validator: "fashion-construction",
        passed: construction.passed,
        reasons: construction.reasons,
      },
      {
        validator: "quality-gate",
        passed: quality.accepted,
        reasons: quality.failureReasons,
      },
    ],
    quality,
    repairHistory: input.repairHistory,
  });
}
