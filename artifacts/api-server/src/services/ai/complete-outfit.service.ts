import { randomUUID } from "node:crypto";
import { logger } from "../../lib/logger.ts";
import { enhanceGarmentPrompt } from "./classic-prompt-enhancer.ts";
import type { generateClassicTexture as GenerateClassicTexture } from "./classic-texture.service.ts";
import {
  AiGenerationError,
  normalizeAiError,
  timeoutMs,
  withAiTimeout,
} from "./ai-errors.ts";
import { planOutfitBlueprint } from "./outfit-blueprint.ts";
import { planOutfitDNA, understandFashionIntent } from "./outfit-dna.ts";

type Dependencies = {
  plan: typeof planOutfitBlueprint;
  generate: typeof GenerateClassicTexture;
  log: (event: string, data: Record<string, unknown>) => void;
};

const defaults: Dependencies = {
  plan: planOutfitBlueprint,
  generate: async (...args) => {
    const { generateClassicTexture } =
      await import("./classic-texture.service.ts");
    return generateClassicTexture(...args);
  },
  log: (event, data) => logger.info(data, event),
};

/** One blueprint and two deliberately sequential image jobs. */
export async function generateCompleteOutfit(
  description: string,
  dependencies: Partial<Dependencies> = {},
) {
  const deps = { ...defaults, ...dependencies };
  const generationId = randomUUID();
  const startedAt = Date.now();
  let stage = "blueprint";
  const emit = (event: string, extra: Record<string, unknown> = {}) =>
    deps.log(event, {
      generationId,
      elapsedMs: Date.now() - startedAt,
      promptLength: description.length,
      currentStage: stage,
      ...extra,
    });
  emit("complete_outfit.request_received");

  try {
    return await withAiTimeout(
      async () => {
        emit("complete_outfit.blueprint_started", {
          openAIRequestType: "none",
        });
        const fashionIntent = understandFashionIntent(description);
        const outfitDNA = planOutfitDNA(fashionIntent, generationId);
        const outfitBlueprint = deps.plan(description);
        emit("complete_outfit.blueprint_completed", {
          openAIRequestType: "none",
        });
        const sharedDirection = `${description}. Complete coordinated ${outfitBlueprint.completeLook}; palette ${[...outfitBlueprint.primaryColours, ...outfitBlueprint.accentColours].join(", ")}.`;
        const shirtPrompt = `${sharedDirection} Top: ${outfitBlueprint.top.type}, ${outfitBlueprint.top.details?.join(", ")}.`;
        const pantsPrompt = `${sharedDirection} Bottom: ${outfitBlueprint.bottom.type}, ${outfitBlueprint.bottom.details?.join(", ")}.`;
        // Specifications are prepared from the single outfit blueprint; no per-item text-AI planning calls.
        const shirtSpecification = enhanceGarmentPrompt("shirt", shirtPrompt);
        const pantsSpecification = enhanceGarmentPrompt("pants", pantsPrompt);
        const diagnostics = { generationId, startedAt, log: deps.log };

        stage = "shirt_generation";
        emit("complete_outfit.shirt_started", {
          openAIRequestType: "images.edit",
          attempt: 1,
        });
        const shirt = await deps.generate(
          "shirt",
          shirtPrompt,
          shirtSpecification,
          diagnostics,
          outfitDNA,
        );
        emit("complete_outfit.shirt_completed", {
          openAIRequestType: "images.edit",
          attempt: shirt.attempts,
        });

        stage = "pants_generation";
        emit("complete_outfit.pants_started", {
          openAIRequestType: "images.edit",
          attempt: 1,
        });
        const pants = await deps.generate(
          "pants",
          pantsPrompt,
          pantsSpecification,
          diagnostics,
          outfitDNA,
        );
        emit("complete_outfit.pants_completed", {
          openAIRequestType: "images.edit",
          attempt: pants.attempts,
        });

        stage = "response";
        const result = {
          generationId,
          preview: {
            shirtTexture: shirt.imageUrl,
            pantsTexture: pants.imageUrl,
            view: "front",
          },
          fashionIntent,
          outfitDNA,
          pipelineStages: [
            "intent",
            "fashion-planner",
            "material-generator",
            "garment-constructor",
            "quality-inspector",
          ],
          outfitBlueprint,
          components: {
            shirtTexture: shirt.imageUrl,
            pantsTexture: pants.imageUrl,
            footwearPreview: {
              ...outfitBlueprint.footwear,
              support: "downloadable preview only",
            },
            accessories: outfitBlueprint.accessories.map((name) => ({
              name,
              support: "planned for future 3D support",
            })),
          },
          export: {
            robloxItemCount: 2,
            supportedItems: ["shirt", "pants"],
            previewOnlyItems: ["footwear", ...outfitBlueprint.accessories],
          },
        };
        emit("complete_outfit.response_ready");
        return result;
      },
      timeoutMs("COMPLETE_OUTFIT_TIMEOUT_MS", 260_000),
      stage,
    );
  } catch (error) {
    const normalized =
      error instanceof AiGenerationError
        ? error
        : normalizeAiError(error, stage);
    const failure =
      normalized.code === "AI_TIMEOUT" &&
      normalized.stage === "blueprint" &&
      stage !== "blueprint"
        ? new AiGenerationError(
            normalized.message,
            normalized.code,
            stage,
            normalized.retryable,
            normalized.status,
          )
        : normalized;
    deps.log("complete_outfit.failed", {
      generationId,
      elapsedMs: Date.now() - startedAt,
      promptLength: description.length,
      currentStage: failure.stage,
      errorName: failure.name,
      status: failure.status,
      code: failure.code,
    });
    throw failure;
  }
}
