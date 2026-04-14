import { z } from "zod";
import {
  aiDesignSchema,
  aiGenerateRequestSchema,
  aiImproveRequestSchema,
  aiLayoutSchema,
  aiModulesSchema,
  aiPaletteSchema,
  validatePlacementForItemType,
} from "../../lib/ai-contracts";

function hexToRgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(a: string, b: string) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export class AiValidationService {
  parseGenerateRequest(payload: unknown) {
    return aiGenerateRequestSchema.parse(payload);
  }

  parseImproveRequest(payload: unknown) {
    return aiImproveRequestSchema.parse(payload);
  }

  ensureDesign(payload: unknown) {
    const design = aiDesignSchema.parse(payload);
    if (!validatePlacementForItemType(design)) {
      throw new z.ZodError([{ code: "custom", message: "Invalid itemType placement mapping", path: ["placement"] }]);
    }

    const paletteContrast = contrastRatio(design.paletteRoles.contrastPair[0], design.paletteRoles.contrastPair[1]);
    if (paletteContrast < 2.4) {
      throw new z.ZodError([{ code: "custom", message: "Palette contrast pair is too weak for Roblox readability", path: ["paletteRoles", "contrastPair"] }]);
    }

    const uniqueModuleTypes = new Set(design.modules.map((module) => module.type));
    if (uniqueModuleTypes.size < 2) {
      throw new z.ZodError([{ code: "custom", message: "Design needs at least two module types for visual depth", path: ["modules"] }]);
    }

    const hasHeroModule = design.modules.some((module) => module.scale >= 0.75 && module.opacity >= 0.7);
    if (!hasHeroModule) {
      throw new z.ZodError([{ code: "custom", message: "Design missing a hero-readable module", path: ["modules"] }]);
    }

    if (design.avatarCoordination.accessoryIntent.includes("footwear") && design.itemType !== "classic_pants") {
      throw new z.ZodError([{ code: "custom", message: "Footwear-heavy avatar intent should be paired with pants concepts", path: ["avatarCoordination", "accessoryIntent"] }]);
    }

    return design;
  }

  ensureModules(payload: unknown) {
    return aiModulesSchema.parse(payload);
  }

  ensurePalette(payload: unknown) {
    return aiPaletteSchema.parse(payload);
  }

  ensureLayout(payload: unknown) {
    return aiLayoutSchema.parse(payload);
  }
}

export const aiValidationService = new AiValidationService();
