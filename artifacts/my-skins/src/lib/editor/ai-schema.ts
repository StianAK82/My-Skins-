import { z } from "zod";
import type { DesignLayer } from "./design-state.ts";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const aiLayerSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["imageLayer", "textLayer", "accessoryLayer", "paintLayerSet", "moduleLayer"]),
  zone: z.string().min(1),
  text: z.string().optional(),
  image: z.string().optional(),
  color: hexColor.optional(),
  assetId: z.string().optional(),
  assetCategory: z.string().optional(),
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
}).strict();

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
    transform: { x: layer.transform?.x ?? 0, y: layer.transform?.y ?? 0, scale: layer.transform?.scale ?? 1, rotation: layer.transform?.rotation ?? 0, opacity: layer.transform?.opacity ?? 1, visible: true, locked: false },
  }));
}
