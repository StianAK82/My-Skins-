import { z } from "zod";

export const requiredVisualViews = ["front", "side", "back", "front_45", "back_45"] as const;
export const finalVisualStatusSchema = z.enum(["READY", "NEEDS_REPAIR", "UNSUPPORTED", "MANUAL_REVIEW"]);

export const visualRepairDirectiveSchema = z.object({
  targetItemId: z.string().min(1).max(100),
  targetGroup: z.string().min(1).max(100),
  issue: z.string().min(1).max(240),
  operation: z.enum(["adjust_proportions", "adjust_placement", "adjust_material", "repair_construction", "repair_clipping", "regenerate_texture"]),
  instruction: z.string().min(1).max(300),
  severity: z.enum(["critical", "major", "minor"]),
});

export const visualDesignReviewSchema = z.object({
  status: finalVisualStatusSchema,
  observations: z.object({
    selectedConceptVisible: z.boolean(), heroElementVisible: z.boolean(), silhouetteMatches: z.boolean(),
    materialsReadable: z.boolean(), frontBackCoherent: z.boolean(), noCriticalClipping: z.boolean(),
    noRequestedItemMissing: z.boolean(), originalEnough: z.boolean(), classicExportValid: z.boolean(),
  }),
  defects: z.array(z.string().min(1).max(240)).max(12),
  repairs: z.array(visualRepairDirectiveSchema).max(8),
  summary: z.string().min(1).max(500),
}).superRefine((review, ctx) => {
  const allPass = Object.values(review.observations).every(Boolean);
  if (review.status === "READY" && (!allPass || review.defects.length || review.repairs.length))
    ctx.addIssue({ code: "custom", message: "READY requires every visible observation to pass with no defects or repairs" });
});

export type VisualDesignReview = z.infer<typeof visualDesignReviewSchema>;
export type VisualRepairDirective = z.infer<typeof visualRepairDirectiveSchema>;

export const visualReviewRequestSchema = z.object({
  generationId: z.string().min(1).max(100), attempt: z.number().int().min(1).max(3),
  prompt: z.string().min(1).max(600), outfitSummary: z.string().min(1).max(2_000),
  itemIds: z.array(z.string().min(1).max(100)).min(1).max(24),
  classicExportValid: z.boolean(),
  views: z.array(z.object({ view: z.enum(requiredVisualViews), imageUrl: z.string().startsWith("data:image/").max(8_000_000) })).length(5)
    .superRefine((views, ctx) => { for (const required of requiredVisualViews) if (!views.some(view => view.view === required)) ctx.addIssue({ code: "custom", message: `Missing required ${required} view` }); }),
});
export type VisualReviewRequest = z.infer<typeof visualReviewRequestSchema>;

export function buildVisualReviewPrompt(input: VisualReviewRequest): string {
  return [
    "You are the categorical final visual reviewer for a premium Roblox skin.",
    "Judge only pixels in all five supplied browser renders. Never infer quality from metadata and never return a numeric score.",
    `Original request: ${input.prompt}`, `Stable item IDs: ${input.itemIds.join(", ")}`, `Outfit: ${input.outfitSummary}`,
    `Classic export preflight valid: ${input.classicExportValid}`,
    "Check: selected concept visible; hero element visible; silhouette matches; materials readable; front/back coherent; no critical clipping; no requested item missing; protected inspiration remains original; Classic export valid.",
    "Every repair must name one supplied stable item ID and the smallest affected existing group. Preserve the concept and unrelated groups.",
    "Return strict JSON only: status (READY, NEEDS_REPAIR, UNSUPPORTED, MANUAL_REVIEW), observations booleans, concrete defects, localized repairs, summary.",
  ].join("\n");
}

export function decideVisualReview(review: VisualDesignReview, attempt: number, maxAttempts = 3) {
  const allPass = Object.values(review.observations).every(Boolean);
  if (review.status === "UNSUPPORTED") return { status: "UNSUPPORTED" as const, repairs: [], defects: review.defects };
  if (allPass && !review.defects.length && !review.repairs.length) return { status: "READY" as const, repairs: [], defects: [] };
  if (attempt < maxAttempts && review.repairs.length) return { status: "NEEDS_REPAIR" as const, repairs: review.repairs, defects: review.defects };
  return { status: "MANUAL_REVIEW" as const, repairs: [], defects: review.defects };
}
