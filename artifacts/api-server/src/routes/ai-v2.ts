import { Router, type IRouter } from "express";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { aiGenerateRequestSchema, aiImproveRequestSchema, stylizedOutfitGenerateRequestSchema } from "../lib/ai-contracts";
import { aiGenerationService } from "../services/ai/ai-generation.service";
import { aiHistoryService } from "../services/ai/ai-history.service";

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
  const details = err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) : ["AI returned non-JSON content"];
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
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await aiGenerationService.generateDesign(authed ? getUserId(req) : null, parsed.data);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      req.log.error({ issues: err.issues }, "ai.v2.generate.schema_invalid");
    }
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate.failed");
    res.status(500).json({ error: "AI generation failed" });
  }
});

const heroImageRequestSchema = z.object({
  prompt: z.string().min(1).max(600),
  kind: z.enum(["motif", "fabric", "garment-top", "garment-bottom"]).optional().default("motif"),
});

// Generates the actual artwork described in the prompt (gpt-image-1, transparent PNG).
router.post("/ai/hero-image", async (req, res): Promise<void> => {
  const parsed = heroImageRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const kind = parsed.data.kind;
    const isFabric = kind === "fabric";
    const isGarment = kind === "garment-top" || kind === "garment-bottom";
    const garmentPart = kind === "garment-top"
      ? "the UPPER-BODY garment (shirt, hoodie, jacket, sweater — whatever upper-body clothing the description mentions or implies)"
      : "the LOWER-BODY garment (trousers, jeans, skirt, shorts — whatever lower-body clothing the description mentions or implies)";
    const imagePrompt = isGarment
      ? [
          `Photorealistic flat clothing texture: the front cloth panel of ${garmentPart}.`,
          `The outfit described by the user: ${parsed.data.prompt}.`,
          "The fabric panel must fill the ENTIRE square canvas edge-to-edge, viewed straight on, like a texture map for a video game character.",
          "Include the realistic details real clothes have: fabric weave/denim grain, seams, stitching, pockets, drawstrings, subtle natural wrinkles and soft shading.",
          "If the description mentions a zipper (glidelås/dragkedja): draw ONE clear full-length zipper running straight down the CENTER of the panel from top edge to bottom edge, with visible metal teeth and a zipper pull.",
          "If the description mentions buttons (knapper/knappar): draw a clear button placket down the center front with evenly spaced, visible buttons from top to bottom.",
          "Do NOT draw a hood or hood outline unless the description explicitly mentions a hood (hette/hood/hoodie/hettegenser).",
          "Do NOT draw faces, eyes, mouths, heads, or melted/dripping creature parts on the fabric — those belong on the character's head/body, never on the clothes.",
          "Do NOT draw a person, mannequin, hanger, background, or the garment's outline/silhouette — only the flat cloth surface with its details, edge-to-edge.",
          "Even lighting, no vignette, no border, no text, no watermark.",
        ].join(" ")
      : isFabric
      ? [
          "Seamless square fabric/material texture for video-game clothing.",
          `The material described: ${parsed.data.prompt}.`,
          "The texture must fill the ENTIRE square canvas edge-to-edge with the material surface itself —",
          "realistic detail like scales, weave, leather grain, stitching, wear and subtle lighting variation.",
          "Do NOT draw any object, garment, person, logo or scene — only the flat material surface, viewed straight on.",
          "Tileable, even lighting, no vignette, no border, no text, no watermark.",
        ].join(" ")
      : [
          "Flat 2D game artwork that will be printed on the front of a Roblox shirt.",
          `The user's description: ${parsed.data.prompt}.`,
          "IMPORTANT: If the description mentions a piece of clothing (shirt, hoodie, genser, jakke, t-skjorte, bukse, drakt, etc.), do NOT draw the garment itself —",
          "draw ONLY the logo, motif, emblem or graphic that should be printed on that garment, faithfully including every detail mentioned about it.",
          "If no garment is mentioned, draw the described subject exactly and faithfully.",
          "Bold, vibrant, high-contrast, centered composition with clean edges.",
          "The subject must be completely isolated on a fully transparent background:",
          "do NOT draw any background, backdrop, gradient, glow, halo, shadow or border around the subject.",
          "No watermark. No frame. No text unless explicitly requested.",
        ].join(" ");

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      size: "1024x1024",
      background: isFabric || isGarment ? "opaque" : "transparent",
      quality: "medium",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      res.status(502).json({ error: "Image generation returned no image" });
      return;
    }
    res.json({ imageUrl: `data:image/png;base64,${b64}` });
  } catch (err) {
    req.log.error({ err }, "ai.v2.hero_image.failed");
    res.status(500).json({ error: "Image generation failed" });
  }
});

router.post("/ai/improve", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiImproveRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await aiGenerationService.improveDesign(getUserId(req), parsed.data.instruction, parsed.data.design, "improve"));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.improve.failed");
    res.status(500).json({ error: "AI improve failed" });
  }
});

router.post("/ai/remix", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiImproveRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await aiGenerationService.improveDesign(getUserId(req), parsed.data.instruction, parsed.data.design, "remix"));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.remix.failed");
    res.status(500).json({ error: "AI remix failed" });
  }
});

router.post("/ai/generate-idea", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await aiGenerationService.generateIdea(parsed.data));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate-idea.failed");
    res.status(500).json({ error: "AI idea generation failed" });
  }
});

router.post("/ai/generate-modules", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await aiGenerationService.generateModules(parsed.data));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate-modules.failed");
    res.status(500).json({ error: "AI modules generation failed" });
  }
});

router.post("/ai/generate-palette", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await aiGenerationService.generatePalette(parsed.data));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate-palette.failed");
    res.status(500).json({ error: "AI palette generation failed" });
  }
});

router.post("/ai/generate-layout", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await aiGenerationService.generateLayout(parsed.data));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate-layout.failed");
    res.status(500).json({ error: "AI layout generation failed" });
  }
});

router.post("/ai/generate-stylized-outfit", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = stylizedOutfitGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await aiGenerationService.generateStylizedOutfit(getUserId(req), parsed.data));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate-stylized-outfit.failed");
    res.status(500).json({ error: "AI stylized outfit generation failed" });
  }
});

router.get("/ai/history", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  res.json(await aiHistoryService.listUserHistory(getUserId(req)));
});

export default router;
