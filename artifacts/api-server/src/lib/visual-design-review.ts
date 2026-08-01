import { z } from "zod";

export const VISUAL_REVIEW_DIMENSIONS = [
  "silhouette",
  "proportions",
  "construction",
  "materialRealism",
  "seamsAndDetails",
  "fitAndClipping",
  "promptFaithfulness",
  "commercialAppeal",
] as const;

const scoreSchema = z.number().int().min(0).max(100);

export const visualRepairDirectiveSchema = z.object({
  targetItemId: z.string().min(1).max(100),
  targetGroup: z.string().min(1).max(100),
  issue: z.string().min(1).max(240),
  operation: z.enum([
    "adjust_proportions",
    "adjust_placement",
    "adjust_material",
    "repair_construction",
    "repair_clipping",
    "regenerate_texture",
  ]),
  instruction: z.string().min(1).max(300),
  severity: z.enum(["critical", "major", "minor"]),
});

export const visualDesignReviewSchema = z.object({
  scores: z.object(
    Object.fromEntries(
      VISUAL_REVIEW_DIMENSIONS.map((key) => [key, scoreSchema]),
    ) as Record<(typeof VISUAL_REVIEW_DIMENSIONS)[number], typeof scoreSchema>,
  ),
  defects: z.array(z.string().min(1).max(240)).max(12),
  repairs: z.array(visualRepairDirectiveSchema).max(8),
  summary: z.string().min(1).max(500),
});

export type VisualDesignReview = z.infer<typeof visualDesignReviewSchema>;
export type VisualRepairDirective = z.infer<typeof visualRepairDirectiveSchema>;

export const visualReviewRequestSchema = z.object({
  generationId: z.string().min(1).max(100),
  attempt: z.number().int().min(1).max(3),
  prompt: z.string().min(1).max(600),
  outfitSummary: z.string().min(1).max(2_000),
  views: z
    .array(
      z.object({
        view: z.enum(["front", "side", "back", "detail"]),
        imageUrl: z.string().startsWith("data:image/").max(8_000_000),
      }),
    )
    .min(3)
    .max(6)
    .superRefine((views, ctx) => {
      for (const required of ["front", "side", "back"] as const) {
        if (!views.some((view) => view.view === required)) {
          ctx.addIssue({
            code: "custom",
            message: `Missing required ${required} view`,
          });
        }
      }
    }),
});

export type VisualReviewRequest = z.infer<typeof visualReviewRequestSchema>;

export const VISUAL_REVIEW_THRESHOLD = 86;

export function buildVisualReviewPrompt(input: VisualReviewRequest): string {
  return [
    "You are the final design director and garment construction reviewer for a premium 3D fashion product.",
    "Judge only visible evidence. Do not reward metadata or intentions that the renders do not prove.",
    `Original request: ${input.prompt}`,
    `Canonical outfit and named geometry: ${input.outfitSummary}`,
    "Inspect front, side, and back together. Check whether the garment could plausibly be sewn, hangs naturally, has coherent thickness, and has believable fabric response.",
    "Pay special attention to hood opening and folds, shoulder/armhole proportion, hems, waist and crotch construction, cargo pockets, sneaker sole/upper separation, hair volume, clipping, and left/right symmetry.",
    "Commercial appeal asks whether the result looks intentional and desirable, not merely technically complete.",
    "Every repair must name an existing item and the smallest geometry/material group that can fix the visible defect. Never propose adding an unrequested garment.",
    "Return strict JSON only with: scores (silhouette, proportions, construction, materialRealism, seamsAndDetails, fitAndClipping, promptFaithfulness, commercialAppeal; integers 0-100), defects, repairs, and summary.",
  ].join("\n");
}

export type VisualReviewDecision = {
  accepted: boolean;
  decision: "accept" | "repair" | "manual_review";
  score: number;
  threshold: number;
  attempt: number;
  repairs: VisualRepairDirective[];
  failureReasons: string[];
};

export function decideVisualReview(
  review: VisualDesignReview,
  attempt: number,
  maxAttempts = 3,
): VisualReviewDecision {
  const values = VISUAL_REVIEW_DIMENSIONS.map(
    (dimension) => review.scores[dimension],
  );
  const score = Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
  const critical = review.repairs.some(
    (repair) => repair.severity === "critical",
  );
  const accepted = score >= VISUAL_REVIEW_THRESHOLD && !critical;
  return {
    accepted,
    decision: accepted
      ? "accept"
      : attempt < maxAttempts && review.repairs.length
        ? "repair"
        : "manual_review",
    score,
    threshold: VISUAL_REVIEW_THRESHOLD,
    attempt,
    repairs: accepted ? [] : review.repairs,
    failureReasons: accepted ? [] : review.defects,
  };
}
