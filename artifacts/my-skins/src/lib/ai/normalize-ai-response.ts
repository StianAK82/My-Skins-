import { z } from "zod";
import type { AiLifecycleMeta } from "@/types/lifecycle";

const aiResponseSchema = z.object({
  meta: z.object({
    generationId: z.string(),
    status: z.enum(["queued", "processing", "completed", "degraded", "failed"]),
    warnings: z.array(z.string()).default([]),
  }),
  result: z.object({
    title: z.string(),
    itemType: z.enum(["classic_shirt", "classic_pants"]),
    style: z.string(),
    styleIdentity: z.string().optional(),
    paletteRoles: z.object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
      neutral: z.string(),
      contrastPair: z.tuple([z.string(), z.string()]),
      contrastLevel: z.enum(["high", "medium"]),
    }).optional(),
    target: z.literal("roblox"),
    theme: z.string(),
    colorPalette: z.array(z.string()),
    designElements: z.array(z.string()),
    placement: z.object({
      front: z.string(),
      back: z.string(),
      leftSleeve: z.string(),
      rightSleeve: z.string(),
      leftLeg: z.string(),
      rightLeg: z.string(),
    }),
    modules: z.array(z.object({
      id: z.string(),
      type: z.string(),
      label: z.string(),
      color: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      scale: z.number(),
      rotation: z.number(),
      opacity: z.number(),
      layer: z.number(),
    })),
    outfitComposition: z.object({
      silhouette: z.enum(["slim", "balanced", "oversized", "armored"]),
      vibe: z.enum(["subtle", "bold", "flashy", "minimal"]),
      garmentFocus: z.enum(["front_graphic", "allover_pattern", "trim_work", "symbolic", "split_panel"]),
      trimIntent: z.string(),
      patternDensity: z.enum(["none", "light", "medium", "heavy"]),
      accessoryDensity: z.enum(["none", "light", "medium", "heavy"]),
    }).optional(),
    avatarCoordination: z.object({
      faceMood: z.string(),
      hairMood: z.string(),
      auraIntent: z.string(),
      accessoryIntent: z.array(z.string()),
      cohesionNotes: z.array(z.string()),
    }).optional(),
    qualitySignals: z.object({
      distinctiveness: z.number(),
      paletteScore: z.number(),
      coherenceScore: z.number(),
      robloxReadability: z.number(),
    }).optional(),
    editorInstructions: z.object({
      baseTemplate: z.string(),
      recommendedPreset: z.string(),
      notes: z.array(z.string()),
    }),
  }),
});

export type NormalizedAiResponse = z.infer<typeof aiResponseSchema>;

export function normalizeAiResponse(input: unknown): { meta: AiLifecycleMeta; result: NormalizedAiResponse["result"] } {
  return aiResponseSchema.parse(input);
}
