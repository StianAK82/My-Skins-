import { classifyGarmentDescription } from "@workspace/integrations-openai-ai-server";
import type { ClassicGarment } from "./classic-atlas";
import { enhanceGarmentPrompt, type EnhancedGarmentSpecification } from "./classic-prompt-enhancer";

/** Plan before prompting: semantic classification enriches deterministic tailoring rules. */
export async function planGarmentBlueprint(type: ClassicGarment, description: string): Promise<EnhancedGarmentSpecification> {
  try {
    const classification = await classifyGarmentDescription(description);
    return enhanceGarmentPrompt(type, description, classification);
  } catch {
    // Generation must remain available if the lightweight planning call is unavailable.
    return enhanceGarmentPrompt(type, description);
  }
}
