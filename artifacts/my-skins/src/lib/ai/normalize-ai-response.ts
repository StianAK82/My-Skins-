import { z } from "zod";
import type { AiLifecycleMeta } from "@/types/lifecycle";

const previewSlotSchema = z.enum(["face", "hair", "hat", "neck", "leftShoulder", "rightShoulder", "back", "leftFootwear", "rightFootwear", "aura"]);
const assetRoleSchema = z.enum(["hero", "support", "decorative"]);

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
    target: z.literal("roblox"),
    theme: z.string(),
    colorPalette: z.array(z.string()),
    designElements: z.array(z.string()),
    intent: z.object({
      primaryFocus: z.enum(["clothing", "outfit", "avatar_look", "accessory", "creature_fantasy", "effect_aura", "mixed"]),
      requestKinds: z.array(z.enum(["clothing", "outfit", "avatar_look", "accessory", "creature_fantasy", "effect_aura", "mixed"])),
      styleVibes: z.array(z.enum(["anime", "cyber", "dark_flame", "fantasy", "cute", "tactical", "streetwear", "villain", "dragon", "angelic", "sporty"])),
      includesAvatarLook: z.boolean(),
      includesAccessories: z.boolean(),
      includesEffects: z.boolean(),
      fantasyArchetype: z.enum(["dragon", "demon", "angel"]).nullable(),
    }),
    clothingPlan: z.object({
      summary: z.string(),
      layers: z.array(z.string()),
      paletteLogic: z.string(),
    }),
    avatarLookPlan: z.object({
      identity: z.string(),
      silhouette: z.string(),
      hair: z.string(),
      face: z.string(),
      aura: z.string().nullable(),
    }),
    accessoryPlan: z.object({
      items: z.array(z.object({
        name: z.string(),
        slot: previewSlotSchema,
        detail: z.string(),
        role: assetRoleSchema,
        exportStatus: z.literal("preview_only"),
      })),
    }),
    previewOnlyPlan: z.object({
      cosmetics: z.array(z.object({ category: z.string(), label: z.string(), slot: previewSlotSchema, role: assetRoleSchema })),
    }),
    exportablePlan: z.object({
      classicShirt: z.boolean(),
      classicPants: z.boolean(),
      notes: z.array(z.string()),
    }),
    avatarSlotPlan: z.array(z.object({
      slot: previewSlotSchema,
      assetHint: z.string(),
      role: assetRoleSchema,
      rationale: z.string(),
      color: z.string().optional(),
    })),
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
    editorInstructions: z.object({
      baseTemplate: z.string(),
      recommendedPreset: z.string(),
      notes: z.array(z.string()),
    }),
    // The AI's full structured outfit plan (handles typos/Norwegian, lists every requested item).
    outfit: z.object({
      top: z.enum(["hoodie", "sweater", "tshirt", "jacket", "dress", "none"]),
      bottom: z.enum(["pants", "shorts", "skirt", "none"]),
      shoes: z.enum(["none", "sneakers", "boots"]),
      hair: z.object({
        style: z.enum(["none", "short", "long", "ponytail", "twintails", "spiky", "curly", "braids", "wavy", "snakes"]),
        color: z.string(),
      }),
      accessories: z.array(z.object({
        kind: z.enum(["cap", "beanie", "hat", "helmet", "crown", "glasses", "mask", "wings", "backpack", "bag", "necklace", "scarf", "horns", "tail", "belt", "gloves", "unicorn_horn", "dragon_hood", "jetpack", "sword", "shoulder_guards", "shoulder_pet", "aura", "flame_aura", "pixel_aura"]),
        color: z.string(),
      })).max(6),
      customParts: z.array(z.object({
        name: z.string(),
        shape: z.enum(["horn", "spike", "orb", "plate", "band", "snake", "fin", "blob"]),
        attach: z.enum(["forehead", "head_top", "face", "neck", "chest", "belly", "back", "hips", "left_shoulder", "right_shoulder", "left_hand", "right_hand", "left_leg", "right_leg", "left_foot", "right_foot"]),
        color: z.string(),
        size: z.enum(["small", "medium", "large"]),
      })).max(4).optional(),
      unsupported: z.array(z.string()),
      reason: z.string(),
    }).optional(),
    // The AI's own reading of which clothing pieces the user asked for (handles typos/Norwegian).
    garments: z.object({
      top: z.enum(["hoodie", "sweater", "tshirt", "jacket", "none"]),
      bottom: z.enum(["pants", "shorts", "none"]),
      shoes: z.boolean(),
      reason: z.string(),
    }).optional(),
  }),
});

export type NormalizedAiResponse = z.infer<typeof aiResponseSchema>;

export function normalizeAiResponse(input: unknown): { meta: AiLifecycleMeta; result: NormalizedAiResponse["result"] } {
  return aiResponseSchema.parse(input);
}
