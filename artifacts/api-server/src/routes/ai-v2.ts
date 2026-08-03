import { Router, type IRouter } from "express";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  aiGenerateRequestSchema,
  aiImproveRequestSchema,
  stylizedOutfitGenerateRequestSchema,
} from "../lib/ai-contracts";
import { aiGenerationService } from "../services/ai/ai-generation.service";
import { aiHistoryService } from "../services/ai/ai-history.service";
import {
  IMAGE_SAFETY_CHECK_PROMPT,
  SafetyError,
  assertImageAllowed,
  hashImage,
  hashPrompt,
  parseImageSafetyVerdict,
} from "../lib/safety-gateway";
import {
  buildVisualReviewPrompt,
  decideVisualReview,
  visualDesignReviewSchema,
  visualReviewRequestSchema,
} from "../lib/visual-design-review";
import { EntitlementError, generationEntitlements } from "../lib/generation-entitlements";

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
  const requestId = String(req.id ?? req.headers["x-request-id"] ?? "request-unknown");
  if (!req.isAuthenticated()) {
    res.status(401).json(new EntitlementError("AUTH_REQUIRED", requestId, req.body?.generationId, "authentication", false, "Please sign in to make your first skin.", "SESSION_REQUIRED").toJSON());
    return;
  }
  const parsed = aiGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  if (!parsed.data.clientRequestId || !parsed.data.generationId || !parsed.data.idempotencyKey || !parsed.data.requestedMode) {
    res.status(400).json({ code: "CREDIT_RESERVATION_FAILED", requestId, generationId: parsed.data.generationId, stage: "validation", retryable: false, message: "This skin request is missing safe request details.", diagnosticCode: "MISSING_IDEMPOTENCY_FIELDS" });
    return;
  }

  try {
    await generationEntitlements.ensureFreeFirstEntitlement(getUserId(req));
    const reservation = await generationEntitlements.reserveGenerationCredit({
      userId: getUserId(req), clientRequestId: parsed.data.clientRequestId,
      idempotencyKey: parsed.data.idempotencyKey, generationId: parsed.data.generationId,
      requestedMode: parsed.data.requestedMode, requestId,
    });
    if (reservation.existing) {
      const existing = await aiHistoryService.getUserGeneration?.(getUserId(req), parsed.data.generationId);
      if (existing) { res.json(existing); return; }
      res.status(409).json(new EntitlementError("GENERATION_IN_PROGRESS", requestId, parsed.data.generationId, "generation", true, "Your skin is still being made.", "RESERVATION_ALREADY_ACTIVE").toJSON());
      return;
    }
    const result = await aiGenerationService.generateDesign(
      getUserId(req),
      parsed.data,
      parsed.data.generationId,
    );
    if (result.finalSkinStatus === "UNSUPPORTED") {
      await generationEntitlements.releaseGenerationCredit(getUserId(req), parsed.data.generationId, "UNSUPPORTED", requestId);
    }
    res.json({ ...result, reservationId: reservation.reservationId, requestedMode: parsed.data.requestedMode });
  } catch (err) {
    if (err instanceof EntitlementError) { res.status(err.code === "NO_GENERATION_CREDITS" ? 402 : 409).json(err.toJSON()); return; }
    await generationEntitlements.releaseGenerationCredit(getUserId(req), parsed.data.generationId, err instanceof z.ZodError ? "INVALID_SCHEMA" : "PROVIDER_FAILURE", requestId).catch(() => undefined);
    if (err instanceof z.ZodError) {
      req.log.error({ issues: err.issues }, "ai.v2.generate.schema_invalid");
    }
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return schema422(req, res, err);
    req.log.error({ err }, "ai.v2.generate.failed");
    res.status(500).json({ error: "AI generation failed" });
  }
});

router.post("/ai/visual-review", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = visualReviewRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        error: "Invalid visual review request",
        details: parsed.error.flatten(),
      });
    return;
  }

  try {
    const requestId = String(req.id ?? "request-unknown");
    const reservation = await generationEntitlements.getReservationByGeneration(getUserId(req), parsed.data.generationId);
    if (!reservation || reservation.status !== "ACTIVE") { res.status(409).json(new EntitlementError("GENERATION_ALREADY_EXISTS",requestId,parsed.data.generationId,"visual_review",false,"This skin cannot be reviewed again.","NO_ACTIVE_RESERVATION").toJSON()); return; }
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4_096,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildVisualReviewPrompt(parsed.data) },
            ...parsed.data.views.map((view) => ({
              type: "image_url" as const,
              image_url: { url: view.imageUrl, detail: "high" as const },
            })),
          ],
        },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new SyntaxError("Visual reviewer returned no result");
    const json =
      content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? content;
    const review = visualDesignReviewSchema.parse(JSON.parse(json));
    const gate = decideVisualReview(review, parsed.data.attempt);
    if (gate.status === "READY") await generationEntitlements.captureGenerationCredit(getUserId(req), parsed.data.generationId, requestId);
    else if (["UNSUPPORTED", "MANUAL_REVIEW"].includes(gate.status) || (gate.status === "NEEDS_REPAIR" && parsed.data.attempt >= 2)) await generationEntitlements.releaseGenerationCredit(getUserId(req), parsed.data.generationId, gate.status, requestId);
    req.log.info(
      {
        generationId: parsed.data.generationId,
        attempt: parsed.data.attempt,
        status: gate.status,
        repairCount: gate.repairs.length,
      },
      "ai.visual_review.completed",
    );
    res.json({ generationId: parsed.data.generationId, status: gate.status, defects: gate.defects, repairs: gate.repairs, review });
  } catch (err) {
    await generationEntitlements.releaseGenerationCredit(getUserId(req), parsed.data.generationId, "EXTERNAL_VERIFICATION_UNAVAILABLE", String(req.id ?? "request-unknown")).catch(() => undefined);
    if (err instanceof EntitlementError) { res.status(409).json(err.toJSON()); return; }
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return schema422(req, res, err);
    req.log.error(
      { err, generationId: parsed.data.generationId },
      "ai.visual_review.failed",
    );
    res.status(502).json({ error: "Visual design review failed" });
  }
});

const heroImageRequestSchema = z.object({
  prompt: z.string().min(1).max(600),
  kind: z
    .enum(["motif", "fabric", "garment-top", "garment-bottom"])
    .optional()
    .default("motif"),
  generationId: z.string().regex(/^[A-Za-z0-9:_-]{8,200}$/),
});

// Generates the actual artwork described in the prompt (gpt-image-1, transparent PNG).
router.post("/ai/hero-image", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = heroImageRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const reservation = await generationEntitlements.getReservationByGeneration(getUserId(req), parsed.data.generationId);
    if (!reservation || reservation.status !== "ACTIVE") { res.status(402).json(new EntitlementError("NO_GENERATION_CREDITS",String(req.id??"request-unknown"),parsed.data.generationId,"image_generation",false,"You need more skin credits.","IMAGE_WITHOUT_ACTIVE_RESERVATION").toJSON()); return; }
    const kind = parsed.data.kind;
    const isFabric = kind === "fabric";
    const isGarment = kind === "garment-top" || kind === "garment-bottom";
    const garmentPart =
      kind === "garment-top"
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

    // Output moderation: the generated image is checked BEFORE it is returned
    // (vision safety check — the AI proxy has no /moderations endpoint).
    // Fail-closed: if the check itself fails, the image is not served.
    const dataUrl = `data:image/png;base64,${b64}`;
    let outcome;
    try {
      const moderationResponse = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: IMAGE_SAFETY_CHECK_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Review this generated image for child safety.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      });
      outcome = parseImageSafetyVerdict(
        moderationResponse.choices[0]?.message?.content ?? "",
      );
    } catch (moderationErr) {
      req.log.error(
        { err: moderationErr, imageHash: hashImage(b64) },
        "ai.v2.hero_image.output_moderation_unavailable",
      );
      res.status(502).json({ error: "Image safety check failed" });
      return;
    }

    // Data-minimized audit log: hash + categories, never the image or prompt text.
    req.log.info(
      {
        stage: "output_moderation",
        decision: outcome.flagged ? "blocked" : "allowed",
        categories: outcome.categories,
        imageHash: hashImage(b64),
        promptHash: hashPrompt(parsed.data.prompt),
      },
      "safety_gateway.output_moderation",
    );
    assertImageAllowed(outcome);

    res.json({ imageUrl: dataUrl });
  } catch (err) {
    if (err instanceof SafetyError) {
      req.log.warn(
        { code: err.code, stage: err.stage, categories: err.categories },
        "safety_gateway.blocked",
      );
      res.status(err.httpStatus).json({
        error: err.code,
        code: err.code,
        message: err.message,
        stage: err.stage,
        retryable: err.retryable,
      });
      return;
    }
    req.log.error({ err }, "ai.v2.hero_image.failed");
    res.status(500).json({ error: "Image generation failed" });
  }
});

// These former standalone provider entry points could bypass the logical-generation
// reservation. Complete redesigns now start at /ai/generate; localized repair and
// image work carry the original generationId through the protected endpoints.
router.use(["/ai/improve", "/ai/remix", "/ai/generate-idea", "/ai/generate-modules", "/ai/generate-palette", "/ai/generate-layout", "/ai/generate-stylized-outfit"], (_req, res) => {
  res.setHeader("Deprecation", "true");
  res.status(410).json({ code: "GENERATION_ALREADY_EXISTS", message: "Start a new design with /api/ai/generate.", stage: "route_migration", retryable: false, requestId: "deprecated-route", diagnosticCode: "UNRESERVED_PROVIDER_ROUTE_DISABLED" });
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
