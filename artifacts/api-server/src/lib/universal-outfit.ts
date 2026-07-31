import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

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
    "zip_hoodie",
    "jacket",
    "varsity_jacket",
    "winter_coat",
    "football_jersey",
    "formal_shirt",
    "suit_jacket",
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
    "backpack",
    "shoulder_bag",
    "wings",
    "crown",
    "mask",
    "belt",
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
