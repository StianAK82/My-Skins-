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
