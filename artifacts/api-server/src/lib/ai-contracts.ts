import { z } from "zod";

export const itemTypeSchema = z.enum(["classic_shirt", "classic_pants"]);
export const aiLifecycleStatusSchema = z.enum(["queued", "processing", "completed", "degraded", "failed"]);

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const moduleTypeSchema = z.enum([
  "graphic",
  "trim",
  "pattern",
  "sleeve_detail",
  "chest_symbol",
  "stripe",
]);

const intentFocusSchema = z.enum(["clothing", "outfit", "avatar_look", "accessory", "creature_fantasy", "effect_aura", "mixed"]);
const styleVibeSchema = z.enum(["anime", "cyber", "dark_flame", "fantasy", "cute", "tactical", "streetwear", "villain", "dragon", "angelic", "sporty"]);
const previewSlotSchema = z.enum(["face", "hair", "hat", "neck", "leftShoulder", "rightShoulder", "back", "leftFootwear", "rightFootwear", "aura"]);
const assetRoleSchema = z.enum(["hero", "support", "decorative"]);

const aiIntentSchema = z.object({
  primaryFocus: intentFocusSchema,
  requestKinds: z.array(intentFocusSchema).min(1).max(7),
  styleVibes: z.array(styleVibeSchema).max(8),
  includesAvatarLook: z.boolean(),
  includesAccessories: z.boolean(),
  includesEffects: z.boolean(),
  fantasyArchetype: z.enum(["dragon", "demon", "angel"]).nullable(),
}).strict();

const clothingPlanSchema = z.object({
  summary: z.string().min(1),
  layers: z.array(z.string().min(1)).min(1).max(12),
  paletteLogic: z.string().min(1),
}).strict();

const avatarLookPlanSchema = z.object({
  identity: z.string().min(1),
  silhouette: z.string().min(1),
  hair: z.string().min(1),
  face: z.string().min(1),
  aura: z.string().nullable(),
}).strict();

const accessoryPlanSchema = z.object({
  items: z.array(z.object({
    name: z.string().min(1),
    slot: previewSlotSchema,
    detail: z.string().min(1),
    role: assetRoleSchema,
    exportStatus: z.enum(["preview_only"]),
  }).strict()).max(12),
}).strict();

const previewOnlyPlanSchema = z.object({
  cosmetics: z.array(z.object({
    category: z.string().min(1),
    label: z.string().min(1),
    slot: previewSlotSchema,
    role: assetRoleSchema,
  }).strict()).max(16),
}).strict();

const exportablePlanSchema = z.object({
  classicShirt: z.boolean(),
  classicPants: z.boolean(),
  notes: z.array(z.string().min(1)).min(1).max(8),
}).strict();

const avatarSlotPlanSchema = z.object({
  slot: previewSlotSchema,
  assetHint: z.string().min(1),
  role: assetRoleSchema,
  rationale: z.string().min(1),
  color: hexColorSchema.optional(),
}).strict();

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

export const aiGarmentsSchema = z.object({
  top: z.enum(["hoodie", "sweater", "tshirt", "jacket", "none"]),
  bottom: z.enum(["pants", "shorts", "none"]),
  shoes: z.boolean(),
  reason: z.string(),
}).strict();

export const aiOutfitSchema = z.object({
  top: z.enum(["hoodie", "sweater", "tshirt", "jacket", "dress", "none"]),
  bottom: z.enum(["pants", "shorts", "skirt", "none"]),
  shoes: z.enum(["none", "sneakers", "boots"]),
  shoesColor: hexColorSchema.optional(),
  topDescription: z.string().max(400).optional(),
  bottomDescription: z.string().max(400).optional(),
  hair: z.object({
    style: z.enum(["none", "short", "long", "ponytail", "twintails", "spiky", "curly", "braids", "wavy", "snakes"]),
    color: hexColorSchema,
  }).strict(),
  accessories: z.array(z.object({
    kind: z.enum(["cap", "beanie", "hat", "helmet", "crown", "glasses", "mask", "wings", "backpack", "bag", "necklace", "scarf", "horns", "tail", "belt", "gloves", "unicorn_horn", "dragon_hood", "jetpack", "sword", "shoulder_guards", "shoulder_pet", "aura", "flame_aura", "pixel_aura"]),
    color: hexColorSchema,
    size: z.enum(["small", "medium", "large"]).optional().default("medium"),
  }).strict()).max(6),
  customParts: z.array(z.object({
    name: z.string(),
    shape: z.enum(["horn", "spike", "orb", "plate", "band", "snake", "fin", "blob", "headcover"]),
    attach: z.enum(["forehead", "head_top", "face", "neck", "chest", "belly", "back", "hips", "left_shoulder", "right_shoulder", "left_hand", "right_hand", "left_leg", "right_leg", "left_foot", "right_foot"]),
    color: hexColorSchema,
    size: z.enum(["small", "medium", "large"]),
  }).strict()).max(4).optional(),
  unsupported: z.array(z.string()).max(6),
  reason: z.string(),
}).strict();

export const aiDesignSchema = z.object({
  outfit: aiOutfitSchema.optional(),
  garments: aiGarmentsSchema.optional(),
  title: z.string().min(1),
  itemType: itemTypeSchema,
  style: z.string().min(1),
  target: z.literal("roblox"),
  theme: z.string().min(1),
  colorPalette: z.array(hexColorSchema).min(2).max(8),
  designElements: z.array(z.string().min(1)).min(1).max(12),
  intent: aiIntentSchema,
  clothingPlan: clothingPlanSchema,
  avatarLookPlan: avatarLookPlanSchema,
  accessoryPlan: accessoryPlanSchema,
  previewOnlyPlan: previewOnlyPlanSchema,
  exportablePlan: exportablePlanSchema,
  avatarSlotPlan: z.array(avatarSlotPlanSchema).max(12),
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
  // Revision mode: the previous outfit plan. When present, `prompt` is a change
  // request («gjør vingene større») and the AI must only patch the mentioned fields.
  previousOutfit: aiOutfitSchema.optional(),
  clientRequestId: z.string().regex(/^[A-Za-z0-9:_-]{8,200}$/).optional(),
  generationId: z.string().regex(/^[A-Za-z0-9:_-]{8,200}$/).optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9:_-]{8,200}$/).optional(),
  requestedMode: z.enum(["2D", "3D"]).optional(),
}).strict();

export const stylizedOutfitPieceSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  material: z.string().min(1),
  color: hexColorSchema,
}).strict();

export const stylizedOutfitAccessorySchema = z.object({
  name: z.string().min(1),
  placement: z.string().min(1),
  detail: z.string().min(1),
  color: hexColorSchema,
}).strict();

export const stylizedOutfitConceptSchema = z.object({
  title: z.string().min(1),
  theme: z.string().min(1),
  styleTone: z.string().min(1),
  mood: z.string().min(1),
  visualSummary: z.string().min(1),
  colorPalette: z.array(hexColorSchema).min(3).max(8),
  materials: z.array(z.string().min(1)).min(2).max(10),
  clothingPieces: z.array(stylizedOutfitPieceSchema).min(4).max(14),
  accessories: z.array(stylizedOutfitAccessorySchema).min(1).max(10),
  trimsAndDetails: z.array(z.string().min(1)).min(2).max(12),
}).strict();

export const stylizedOutfitGenerateRequestSchema = z.object({
  prompt: z.string().min(1),
  avatarType: z.string().optional(),
  bodyType: z.string().optional(),
  style: z.string().optional(),
}).strict();


export const aiImproveRequestSchema = z.object({
  instruction: z.string().min(1),
  design: aiDesignSchema,
}).strict();

export const aiHistoryEntrySchema = z.object({
  id: z.string(),
  prompt: z.string(),
  style: z.string().nullable(),
  type: z.string().nullable(),
  createdAt: z.string(),
  status: aiLifecycleStatusSchema,
  result: aiDesignSchema,
}).strict();

export const aiResponseMetaSchema = z.object({
  generationId: z.string(),
  status: aiLifecycleStatusSchema,
  warnings: z.array(z.string()).default([]),
  deprecated: z.boolean().default(false),
}).strict();

export const stylizedOutfitResponseSchema = z.object({
  meta: aiResponseMetaSchema,
  result: stylizedOutfitConceptSchema,
}).strict();

export const aiDesignResponseSchema = z.object({
  meta: aiResponseMetaSchema,
  result: aiDesignSchema,
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
