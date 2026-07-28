import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
export const generationSafetyReportSchema = z.object({
  decision: z.enum(["allow", "transform", "block"]), childFriendly: z.boolean(),
  userMessage: z.string(), protectedIp: z.boolean(),
}).strict();

export const hoodieConstructionSchema = z.object({
  fit: z.enum(["regular", "oversized", "cropped"]),
  torsoWidth: z.number().min(.85).max(1.6), torsoLength: z.number().min(.65).max(1.35),
  torsoDepth: z.number().min(.45).max(.9), shoulderDrop: z.number().min(0).max(.35),
  sleeveLength: z.number().min(.65).max(1.35), sleeveFullness: z.number().min(.7).max(1.5),
  cuffHeight: z.number().min(.08).max(.3), waistbandHeight: z.number().min(.08).max(.3),
  hoodHeight: z.number().min(.65).max(1.35), hoodDepth: z.number().min(.25).max(.75),
  hoodOpeningWidth: z.number().min(.25).max(.75), hoodOpeningHeight: z.number().min(.35).max(1),
  pocketType: z.enum(["kangaroo", "two-front", "none"]), pocketWidth: z.number().min(.25).max(.95),
  pocketHeight: z.number().min(.15).max(.5), drawstringEnabled: z.boolean(),
  drawstringLength: z.number().min(.1).max(.8),
}).strict();

export const generatedGarmentSpecSchema = z.object({
  id: z.string().min(1), category: z.literal("hoodie"), slot: z.literal("top"),
  color: hex, material: z.literal("cotton-fleece"), construction: hoodieConstructionSchema,
}).strict();
export const generatedGraphicSpecSchema = z.object({
  id:z.string(), kind:z.enum(["original-symbol","text","number","pattern"]), content:z.string(),
  placement:z.enum(["front","back","sleeve"]), protectedContentReplaced:z.boolean(),
}).strict();
export const generatedFootwearSpecSchema = z.object({ category:z.literal("none"), previewOnly:z.literal(true) }).strict();
export const robloxClassicExportPlanSchema = z.object({
  shirt:z.literal(true), pants:z.literal(false), width:z.literal(585), height:z.literal(559),
  exportType:z.literal("roblox-classic"), previewRepresentation:z.literal("procedural-hoodie"), hasReal3DExport:z.literal(false),
}).strict();
export const generatedOutfitSpecSchema = z.object({
  requestLanguage:z.enum(["en","no"]), originalPrompt:z.string(), normalisedPrompt:z.string(),
  outfitName:z.string(), overallStyle:z.string(), palette:z.array(hex).min(1), top:generatedGarmentSpecSchema,
  bottom:z.null(), footwear:generatedFootwearSpecSchema, graphics:z.array(generatedGraphicSpecSchema),
  classicExportPlan:robloxClassicExportPlanSchema, safetyDecision:z.enum(["allow","transform"]),
  modelConfidence:z.number().min(0).max(1), generationSeed:z.string().min(1),
}).strict();
export const generationValidationReportSchema = z.object({
  schemaValid:z.boolean(), safetyApproved:z.boolean(), mandatoryParts:z.array(z.string()),
  missingParts:z.array(z.string()), severeIntersections:z.array(z.string()), classicValid:z.boolean(),
}).strict();
export const outfitRevisionRequestSchema = z.object({
  generationId:z.string().uuid(), currentOutfitSpec:generatedOutfitSpecSchema,
  revisionText:z.string().trim().min(2).max(300),
}).strict();
export const outfitRevisionPatchSchema = z.object({
  changes:z.array(z.object({ path:z.string().regex(/^top\.construction\.(hoodHeight|hoodDepth|hoodOpeningWidth|hoodOpeningHeight|torsoWidth|torsoLength|torsoDepth|shoulderDrop|sleeveLength|sleeveFullness|cuffHeight|waistbandHeight|pocketType|pocketWidth|pocketHeight|drawstringEnabled|drawstringLength)$/), value:z.union([z.string(),z.number(),z.boolean()]) }).strict()).min(1).max(4),
}).strict();

export type HoodieConstruction = z.infer<typeof hoodieConstructionSchema>;
export type GeneratedGarmentSpec = z.infer<typeof generatedGarmentSpecSchema>;
export type GeneratedOutfitSpec = z.infer<typeof generatedOutfitSpecSchema>;
export type GenerationValidationReport = z.infer<typeof generationValidationReportSchema>;
