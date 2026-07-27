import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  aiGenerateRequestSchema,
  aiImproveRequestSchema,
  stylizedOutfitGenerateRequestSchema,
} from "../lib/ai-contracts";
import { aiGenerationService } from "../services/ai/ai-generation.service";
import { aiHistoryService } from "../services/ai/ai-history.service";
import { generateClassicTexture } from "../services/ai/classic-texture.service";
import { DESIGN_ISSUES } from "../services/ai/design-memory";
import { recordDesignFeedback } from "../services/ai/design-memory-feedback.service";
import { generateCompleteOutfit } from "../services/ai/complete-outfit.service";

const router: IRouter = Router();

function ensureAuthenticated(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function getUserId(req: any): string {
  return (req.user as { id: string }).id;
}

function schema422(req: any, res: any, err: z.ZodError | SyntaxError) {
  const issues = err instanceof z.ZodError ? err.issues : [];
  const invalidFields = issues.map((issue) => issue.path.join("."));
  const details =
    err instanceof z.ZodError
      ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      : ["AI returned non-JSON content"];
  req.log.error({ invalidFields, details }, "ai.v2.response_schema_invalid");
  res.status(422).json({
    error: "Invalid AI response schema",
    invalidFields,
    details,
  });
}

router.post("/ai/generate", async (req, res): Promise<void> => {
  const authed = req.isAuthenticated();
  const parsed = aiGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await aiGenerationService.generateDesign(
      authed ? getUserId(req) : null,
      parsed.data,
    );
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      req.log.error({ issues: err.issues }, "ai.v2.generate.schema_invalid");
    }
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate.failed");
    res.status(500).json({ error: "AI generation failed" });
  }
});

const classicTextureRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(600),
  garmentType: z.enum(["shirt", "pants"]),
});

const completeOutfitRequestSchema = z.object({ prompt: z.string().trim().min(3).max(600) });

router.post("/ai/complete-outfit", async (req, res): Promise<void> => {
  const parsed = completeOutfitRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  try {
    res.json(await generateCompleteOutfit(parsed.data.prompt));
  } catch (err) {
    req.log.error({ err }, "ai.v2.complete_outfit.failed");
    res.status(502).json({ error: "AI could not create the complete skin" });
  }
});

router.post("/ai/classic-texture", async (req, res): Promise<void> => {
  const parsed = classicTextureRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  try {
    res.json(
      await generateClassicTexture(parsed.data.garmentType, parsed.data.prompt),
    );
  } catch (err) {
    req.log.error({ err }, "ai.v2.classic_texture.failed");
    res
      .status(502)
      .json({ error: "AI could not produce a valid complete classic texture" });
  }
});

const designFeedbackSchema = z.object({
  generationHash: z.string().regex(/^[a-f0-9]{64}$/),
  garmentKey: z.string().trim().min(2).max(50),
  issues: z.array(z.enum(DESIGN_ISSUES)).max(DESIGN_ISSUES.length),
  accepted: z.boolean(),
});

router.post("/ai/classic-texture/feedback", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = designFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await recordDesignFeedback({
      userId: getUserId(req),
      ...parsed.data,
    });
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "ai.v2.classic_texture_feedback.failed");
    res.status(500).json({ error: "AI feedback could not be recorded" });
  }
});

router.post("/ai/improve", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiImproveRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(
      await aiGenerationService.improveDesign(
        getUserId(req),
        parsed.data.instruction,
        parsed.data.design,
        "improve",
      ),
    );
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.improve.failed");
    res.status(500).json({ error: "AI improve failed" });
  }
});

router.post("/ai/remix", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiImproveRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(
      await aiGenerationService.improveDesign(
        getUserId(req),
        parsed.data.instruction,
        parsed.data.design,
        "remix",
      ),
    );
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.remix.failed");
    res.status(500).json({ error: "AI remix failed" });
  }
});

router.post("/ai/generate-idea", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await aiGenerationService.generateIdea(parsed.data));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate-idea.failed");
    res.status(500).json({ error: "AI idea generation failed" });
  }
});

router.post("/ai/generate-modules", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await aiGenerationService.generateModules(parsed.data));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate-modules.failed");
    res.status(500).json({ error: "AI modules generation failed" });
  }
});

router.post("/ai/generate-palette", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await aiGenerationService.generatePalette(parsed.data));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate-palette.failed");
    res.status(500).json({ error: "AI palette generation failed" });
  }
});

router.post("/ai/generate-layout", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await aiGenerationService.generateLayout(parsed.data));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate-layout.failed");
    res.status(500).json({ error: "AI layout generation failed" });
  }
});

router.post("/ai/generate-stylized-outfit", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = stylizedOutfitGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(
      await aiGenerationService.generateStylizedOutfit(
        getUserId(req),
        parsed.data,
      ),
    );
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate-stylized-outfit.failed");
    res.status(500).json({ error: "AI stylized outfit generation failed" });
  }
});

router.get("/ai/history", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  res.json(await aiHistoryService.listUserHistory(getUserId(req)));
});

export default router;
