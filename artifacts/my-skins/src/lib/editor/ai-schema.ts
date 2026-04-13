import { z } from "zod";
import type { DesignLayer } from "./design-state";

const aiLayerSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["imageLayer", "textLayer", "accessoryLayer", "paintLayerSet"]),
  zone: z.string().min(1),
  text: z.string().optional(),
  image: z.string().optional(),
  color: z.string().optional(),
});

export const classicTextureAiSchema = z.object({
  model: z.literal("ClassicTextureAI"),
  layers: z.array(aiLayerSchema).min(1),
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
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false },
  }));
}
