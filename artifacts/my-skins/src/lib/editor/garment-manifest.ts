import { z } from "zod";

export const garmentFits = ["slim", "regular", "relaxed", "oversized", "athletic", "loose", "structured"] as const;
export const garmentMaterials = ["cotton-jersey", "cotton-fleece", "denim", "canvas", "performance-mesh", "wool", "leather-like", "satin-like", "armour", "knitted"] as const;
export const garmentCategories = ["hoodie", "zip-hoodie", "tshirt", "sweatshirt", "football-jersey", "jacket", "jeans", "trousers", "joggers", "cargo-pants", "shorts", "dress", "sneakers", "boots", "football-boots"] as const;

export const moduleParametersSchema = z.object({
  scale: z.number().positive().default(1), position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  thickness: z.number().nonnegative().default(0.02), depth: z.number().nonnegative().default(0.015), curvature: z.number().min(0).max(1).default(0.3),
  taper: z.number().min(-1).max(1).default(0.1), foldIntensity: z.number().min(0).max(1).default(0.4), materialSlot: z.string().default("primary"), visible: z.boolean().default(true),
}).strict();

const garmentSchema = z.object({ category: z.enum(garmentCategories), variant: z.string().min(1), fit: z.enum(garmentFits), length: z.enum(["cropped", "short", "regular", "long", "full"]), material: z.enum(garmentMaterials), constructionModules: z.array(z.string()).min(1) }).strict();
const fallbackSchema = z.object({ requestedGarment: z.string(), resolvedGarment: z.enum(garmentCategories), fallbackUsed: z.literal(true) }).strict();
export const garmentManifestSchema = z.object({
  version: z.literal(1), outfitId: z.string().uuid(), style: z.string().min(1),
  top: garmentSchema.optional(), bottom: garmentSchema.optional(), onePiece: garmentSchema.optional(),
  footwear: z.object({ category: z.enum(garmentCategories), variant: z.string().min(1) }).strict().optional(),
  accessories: z.array(z.object({ category: z.enum(["belt", "scarf", "cape", "shoulder-pads", "chest-armour", "gloves", "backpack", "headwear"]), variant: z.string() }).strict()).default([]),
  fallback: z.array(fallbackSchema).default([]),
  metadata: z.object({ exportType: z.literal("roblox-classic"), previewRepresentation: z.literal("geometry-assisted"), hasReal3DExport: z.literal(false), previewGarments: z.array(z.string()), exportedItems: z.array(z.enum(["shirt", "pants"])) }).strict(),
}).strict().superRefine((value, context) => {
  if (!value.onePiece && !value.top && !value.bottom) context.addIssue({ code: "custom", message: "An outfit needs a garment" });
  if (value.onePiece && (value.top || value.bottom)) context.addIssue({ code: "custom", message: "A replacing one-piece cannot include separate top or bottom shells" });
});

export type GarmentManifest = z.infer<typeof garmentManifestSchema>;
export type GarmentCategory = typeof garmentCategories[number];
export type GarmentFit = typeof garmentFits[number];
export type GarmentMaterial = typeof garmentMaterials[number];
export type GarmentItem = NonNullable<GarmentManifest["top"]>;
export function validateGarmentManifest(input: unknown): GarmentManifest { return garmentManifestSchema.parse(input); }
