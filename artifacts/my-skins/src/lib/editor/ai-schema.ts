import { z } from "zod";
import type { DesignLayer } from "./design-state.ts";
import { TEMPLATE_ZONES } from "./templates.ts";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const aiLayerSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["imageLayer", "textLayer", "accessoryLayer", "paintLayerSet", "moduleLayer"]),
  zone: z.string().min(1),
  placementIntent: z.enum(["hero", "supporting", "edge", "allover"]).optional(),
  anchor: z.enum(["center", "top", "bottom", "left", "right", "top_left", "top_right", "bottom_left", "bottom_right"]).optional(),
  relativeScale: z.number().min(0.15).max(1.35).optional(),
  text: z.string().optional(),
  image: z.string().optional(),
  color: hexColor.optional(),
  assetId: z.string().optional(),
  assetCategory: z.enum(["pattern", "graphic", "trim", "patch", "accessory", "module", "hair"]).optional(),
  transform: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    scale: z.number().min(0.1).max(4).default(1),
    rotation: z.number().min(-360).max(360).default(0),
    opacity: z.number().min(0).max(1).default(1),
  }).partial().optional(),
}).strict();

export const classicTextureAiSchema = z.object({
  model: z.literal("ClassicTextureAI.v2"),
  garmentType: z.enum(["shirt", "pants"]),
  style: z.string().min(1),
  palette: z.array(hexColor).min(2).max(8),
  zones: z.record(z.string().min(1)),
  layers: z.array(aiLayerSchema).min(1),
}).strict().superRefine((payload, ctx) => {
  const templateZones = TEMPLATE_ZONES[payload.garmentType];
  payload.layers.forEach((layer, index) => {
    if (!templateZones[layer.zone]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["layers", index, "zone"],
        message: `Zone "${layer.zone}" is invalid for garment "${payload.garmentType}"`,
      });
    }

    if (layer.type === "textLayer" && !layer.text) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["layers", index, "text"],
        message: "textLayer requires text",
      });
    }

    const requiresImageSource = layer.type === "imageLayer" || layer.type === "moduleLayer" || layer.type === "accessoryLayer";
    if (requiresImageSource && !layer.image && !layer.assetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["layers", index, "image"],
        message: `${layer.type} requires either image or assetId`,
      });
    }

    if (layer.placementIntent === "allover" && layer.assetCategory !== "pattern") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["layers", index, "placementIntent"],
        message: "allover placementIntent is only valid for pattern assets",
      });
    }

    if (layer.type === "accessoryLayer" && layer.assetCategory && !["accessory", "hair"].includes(layer.assetCategory)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["layers", index, "assetCategory"],
        message: "accessoryLayer assetCategory must be accessory or hair",
      });
    }
  });
});

export const aiMediaSchema = z.object({
  model: z.literal("AIMedia"),
  image: z.string().min(10),
  zone: z.string(),
  name: z.string(),
});

export function parseClassicTextureAi(payload: unknown): DesignLayer[] {
  const parsed = classicTextureAiSchema.safeParse(payload);
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data.layers.map((layer) => ({
    id: `ai_${layer.name.replace(/\s+/g, "_")}`,
    name: layer.name,
    type: layer.type,
    zone: layer.zone,
    image: layer.image,
    text: layer.text,
    color: layer.color,
    assetId: layer.assetId,
    assetCategory: layer.assetCategory,
    transform: {
      x: boundOffsetForZone(layer.transform?.x ?? anchorOffset(layer.anchor, layer.zone, parsed.data.garmentType).x, layer.zone, parsed.data.garmentType, "x"),
      y: boundOffsetForZone(layer.transform?.y ?? anchorOffset(layer.anchor, layer.zone, parsed.data.garmentType).y, layer.zone, parsed.data.garmentType, "y"),
      scale: clamp(layer.transform?.scale ?? layer.relativeScale ?? intentScale(layer.placementIntent, layer.type), 0.15, 4),
      rotation: layer.transform?.rotation ?? 0,
      opacity: layer.transform?.opacity ?? 1,
      visible: true,
      locked: false,
    },
  }));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function intentScale(intent: z.infer<typeof aiLayerSchema>["placementIntent"], type: DesignLayer["type"]) {
  if (intent === "hero") return type === "accessoryLayer" ? 0.9 : 1.05;
  if (intent === "supporting") return 0.7;
  if (intent === "edge") return 0.45;
  if (intent === "allover") return 0.55;
  return 1;
}

function anchorOffset(anchor: z.infer<typeof aiLayerSchema>["anchor"], zoneKey: string, garmentType: "shirt" | "pants") {
  const zone = TEMPLATE_ZONES[garmentType][zoneKey];
  if (!zone) return { x: 0, y: 0 };

  const quarterX = zone.width * 0.25;
  const quarterY = zone.height * 0.25;
  switch (anchor) {
    case "top":
      return { x: 0, y: -quarterY };
    case "bottom":
      return { x: 0, y: quarterY };
    case "left":
      return { x: -quarterX, y: 0 };
    case "right":
      return { x: quarterX, y: 0 };
    case "top_left":
      return { x: -quarterX, y: -quarterY };
    case "top_right":
      return { x: quarterX, y: -quarterY };
    case "bottom_left":
      return { x: -quarterX, y: quarterY };
    case "bottom_right":
      return { x: quarterX, y: quarterY };
    default:
      return { x: 0, y: 0 };
  }
}

function boundOffsetForZone(value: number, zoneKey: string, garmentType: "shirt" | "pants", axis: "x" | "y") {
  const zone = TEMPLATE_ZONES[garmentType][zoneKey];
  if (!zone) return value;
  const limit = axis === "x" ? zone.width / 2 : zone.height / 2;
  return clamp(value, -limit, limit);
}
