import type { z } from "zod";
import type { aiDesignSchema } from "../../lib/ai-contracts";

export class AiEditorMapperService {
  toCanvasPlan(design: z.infer<typeof aiDesignSchema>) {
    return {
      baseColor: design.paletteRoles.primary,
      accentColor: design.paletteRoles.accent,
      contrastPair: design.paletteRoles.contrastPair,
      modulePlan: design.modules.map((module) => ({
        ...module,
        normalizedX: Math.max(0, Math.min(1, module.position.x)),
        normalizedY: Math.max(0, Math.min(1, module.position.y)),
      })),
      placement: design.placement,
      avatarCoordination: design.avatarCoordination,
      outfitComposition: design.outfitComposition,
      qualitySignals: design.qualitySignals,
    };
  }
}

export const aiEditorMapperService = new AiEditorMapperService();
