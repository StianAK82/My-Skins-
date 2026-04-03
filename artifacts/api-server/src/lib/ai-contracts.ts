import { z } from "zod";

export const itemTypeSchema = z.enum(["classic_shirt", "classic_pants"]);

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const moduleTypeSchema = z.enum([
  "graphic",
  "trim",
  "pattern",
  "sleeve_detail",
  "chest_symbol",
  "stripe",
]);

export const designModuleSchema = z.object({
  id: z.string().min(1),
  type: moduleTypeSchema,
  label: z.string().min(1),
  color: hexColorSchema,
  position: z.object({ x: z.number(), y: z.number() }).strict(),
  scale: z.number().min(0.1).max(4),
  rotation: z.number().min(-360).max(360),
  opacity: z.number().min(0).max(1),
  layer: z.number().int().min(0),
}).strict();

export const placementSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  leftSleeve: z.string().min(1),
  rightSleeve: z.string().min(1),
  leftLeg: z.string().min(1),
  rightLeg: z.string().min(1),
}).strict();

export const editorInstructionsSchema = z.object({
  baseTemplate: z.string().min(1),
  recommendedPreset: z.string().min(1),
  notes: z.array(z.string().min(1)).min(1),
}).strict();

export const aiDesignSchema = z.object({
  title: z.string().min(1),
  itemType: itemTypeSchema,
  style: z.string().min(1),
  target: z.literal("roblox"),
  theme: z.string().min(1),
  colorPalette: z.array(hexColorSchema).min(2).max(8),
  designElements: z.array(z.string().min(1)).min(1).max(12),
  placement: placementSchema,
  modules: z.array(designModuleSchema).max(50),
  editorInstructions: editorInstructionsSchema,
}).strict();

export const aiIdeaSchema = z.object({
  title: z.string().min(1),
  itemType: itemTypeSchema,
  style: z.string().min(1),
  theme: z.string().min(1),
  summary: z.string().min(1),
  colorPalette: z.array(hexColorSchema).min(2).max(8),
  designElements: z.array(z.string().min(1)).min(1).max(10),
}).strict();

export const aiPaletteSchema = z.object({
  itemType: itemTypeSchema,
  paletteName: z.string().min(1),
  colors: z.array(hexColorSchema).min(3).max(8),
  usageNotes: z.array(z.string().min(1)).min(1).max(8),
}).strict();

export const aiModulesSchema = z.object({
  itemType: itemTypeSchema,
  modules: z.array(designModuleSchema).min(1).max(30),
}).strict();

export const aiLayoutSchema = z.object({
  itemType: itemTypeSchema,
  placement: placementSchema,
  notes: z.array(z.string().min(1)).min(1).max(10),
}).strict();

export const aiGenerateRequestSchema = z.object({
  prompt: z.string().min(1),
  itemType: itemTypeSchema,
  style: z.string().optional(),
  theme: z.string().optional(),
}).strict();

export const aiImproveRequestSchema = z.object({
  instruction: z.string().min(1),
  design: aiDesignSchema,
}).strict();

export function validatePlacementForItemType(design: z.infer<typeof aiDesignSchema>): boolean {
  if (design.itemType === "classic_shirt") {
    return design.placement.leftSleeve !== "not_used"
      && design.placement.rightSleeve !== "not_used"
      && design.placement.leftLeg === "not_used"
      && design.placement.rightLeg === "not_used";
  }

  return design.placement.leftLeg !== "not_used"
    && design.placement.rightLeg !== "not_used"
    && design.placement.leftSleeve === "not_used"
    && design.placement.rightSleeve === "not_used";
}
