import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, aiGenerationsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const STYLE_PRESETS = [
  "Streetwear",
  "Anime",
  "Cyberpunk",
  "Y2K",
  "Minimal",
  "Fantasy",
  "Sport",
  "Luxury",
] as const;

const variantKinds = ["Clean", "Bold", "Premium", "Experimental"] as const;

const graphicTypeSchema = z.enum(["graphic", "emblem", "pattern", "plain"]);
const sideGraphicTypeSchema = z.enum(["pattern", "stripe", "symbol", "plain"]);

const outfitConceptSchema = z.object({
  target: z.enum(["classic_shirt", "classic_pants"]),
  title: z.string().min(1),
  style: z.string().min(1),
  baseColor: z.string().regex(/^#([0-9a-fA-F]{6})$/),
  colorPalette: z.array(z.string().regex(/^#([0-9a-fA-F]{6})$/)).min(3).max(6),
  overallMood: z.string().min(1),
  front: z.object({ description: z.string().min(1), graphicType: graphicTypeSchema }),
  back: z.object({ description: z.string().min(1), graphicType: graphicTypeSchema }),
  leftSleeve: z.object({ description: z.string().min(1), graphicType: sideGraphicTypeSchema }),
  rightSleeve: z.object({ description: z.string().min(1), graphicType: sideGraphicTypeSchema }),
  details: z.array(z.string().min(1)).min(2).max(6),
}).strict();

const regionAssetsSchema = z.object({
  frontImage: z.string().nullable(),
  backImage: z.string().nullable(),
  leftSleeveImage: z.string().nullable(),
  rightSleeveImage: z.string().nullable(),
}).strict();

const generatedOutfitSchema = z.object({
  concept: outfitConceptSchema,
  assets: regionAssetsSchema,
}).strict();

const generateOutfitRequestSchema = z.object({
  prompt: z.string().min(1),
  target: z.enum(["classic_shirt", "classic_pants"]),
  stylePreset: z.enum(STYLE_PRESETS).optional(),
});

const generateVariantsRequestSchema = z.object({
  prompt: z.string().min(1),
  target: z.enum(["classic_shirt", "classic_pants"]),
  stylePreset: z.enum(STYLE_PRESETS).optional(),
  basePlan: outfitConceptSchema.optional(),
});

const generateVariantsResponseSchema = z.object({
  variants: z.array(
    z.object({
      variant: z.enum(variantKinds),
      result: generatedOutfitSchema,
    }),
  ).length(4),
});

const remixOutfitRequestSchema = z.object({
  instruction: z.string().min(1),
  source: generatedOutfitSchema,
});

const listingRequestSchema = z.object({
  result: generatedOutfitSchema,
});

const listingResponseSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).min(3).max(10),
});

const historyEntrySchema = z.object({
  id: z.string(),
  prompt: z.string(),
  style: z.string().nullable(),
  type: z.string().nullable(),
  createdAt: z.string(),
  result: generatedOutfitSchema,
});

function ensureAuthenticated(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function getUserId(req: Request): string {
  return (req.user as { id: string }).id;
}

function parseJson(content: string): unknown {
  return JSON.parse(content);
}

function isPngBase64(base64: string): boolean {
  try {
    const normalized = base64.replace(/\s/g, "");
    const bytes = Buffer.from(normalized, "base64");
    return bytes.length > 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47;
  } catch {
    return false;
  }
}

function normalizeImageDataUrl(value: string, region: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`AI_IMAGE_EMPTY_${region.toUpperCase()}`);
  }

  if (trimmed.startsWith("data:image/png;base64,")) {
    const raw = trimmed.slice("data:image/png;base64,".length);
    if (!isPngBase64(raw)) {
      throw new Error(`AI_IMAGE_INVALID_PNG_${region.toUpperCase()}`);
    }
    return trimmed;
  }

  if (trimmed.startsWith("data:image/")) {
    throw new Error(`AI_IMAGE_UNSUPPORTED_FORMAT_${region.toUpperCase()}`);
  }

  if (!isPngBase64(trimmed)) {
    throw new Error(`AI_IMAGE_INVALID_BASE64_${region.toUpperCase()}`);
  }
  return `data:image/png;base64,${trimmed}`;
}

function sendSchemaError(res: Response, details: string): void {
  res.status(422).json({ error: "Invalid AI response schema", details });
}

function planSystemPrompt(): string {
  return [
    "You are a professional Roblox clothing designer.",
    "Design a wearable Roblox classic clothing concept.",
    "Think in template regions, balanced composition, strong silhouette, clear palette, and game-friendly visuals.",
    "Return only valid JSON.",
  ].join(" ");
}

function buildPlanPrompt(input: z.infer<typeof generateOutfitRequestSchema>, extra?: string): string {
  return [
    `Target: ${input.target}`,
    `Prompt: ${input.prompt}`,
    input.stylePreset ? `Style preset: ${input.stylePreset}` : "",
    extra ?? "",
    "Return strict JSON with keys: target,title,style,baseColor,colorPalette,overallMood,front,back,leftSleeve,rightSleeve,details.",
    "Rules: no copyrighted logos, no placeholder text, no photoreal output, keep visuals avatar-wearable.",
  ].filter(Boolean).join("\n");
}

async function generatePlan(input: z.infer<typeof generateOutfitRequestSchema>, extra?: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: planSystemPrompt() },
      { role: "user", content: buildPlanPrompt(input, extra) },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI_EMPTY_PLAN");
  }

  return outfitConceptSchema.parse(parseJson(content));
}

function visualPrompt(plan: z.infer<typeof outfitConceptSchema>, region: "front" | "back" | "left" | "right"): string {
  const regionDescription = region === "front"
    ? plan.front.description
    : region === "back"
      ? plan.back.description
      : region === "left"
        ? plan.leftSleeve.description
        : plan.rightSleeve.description;

  return [
    "You are generating a clean visual asset for a Roblox clothing region.",
    "Use transparent background.",
    "No brand names.",
    "No Roblox text.",
    "No placeholder text unless explicitly requested.",
    "The result must be suitable for direct use in a Roblox clothing editor.",
    "No photorealism. Stylized clean vector-like graphics only.",
    `Target clothing: ${plan.target}`,
    `Design title: ${plan.title}`,
    `Style: ${plan.style}`,
    `Base color: ${plan.baseColor}`,
    `Palette: ${plan.colorPalette.join(", ")}`,
    `Region: ${region}`,
    `Region description: ${regionDescription}`,
  ].join("\n");
}

async function generateRegionImage(plan: z.infer<typeof outfitConceptSchema>, region: "front" | "back" | "left" | "right") {
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt: visualPrompt(plan, region),
    size: "1024x1024",
    background: "transparent",
  });

  const base64 = response.data[0]?.b64_json;
  if (!base64) {
    throw new Error(`AI_IMAGE_EMPTY_${region.toUpperCase()}`);
  }

  return normalizeImageDataUrl(base64, region);
}

async function buildOutfitResult(input: z.infer<typeof generateOutfitRequestSchema>, extra?: string) {
  const concept = await generatePlan(input, extra);

  try {
    const [frontImage, backImage, leftSleeveImage, rightSleeveImage] = await Promise.all([
      generateRegionImage(concept, "front"),
      generateRegionImage(concept, "back"),
      generateRegionImage(concept, "left"),
      generateRegionImage(concept, "right"),
    ]);

    return generatedOutfitSchema.parse({
      concept,
      assets: { frontImage, backImage, leftSleeveImage, rightSleeveImage },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "IMAGE_GENERATION_FAILED";
    console.error("ai.generate-outfit.assets.failed", {
      target: concept.target,
      prompt: input.prompt,
      stylePreset: input.stylePreset,
      reason,
    });
    return generatedOutfitSchema.parse({
      concept,
      assets: {
        frontImage: null,
        backImage: null,
        leftSleeveImage: null,
        rightSleeveImage: null,
      },
    });
  }
}

async function saveGeneration(req: Request, prompt: string, stylePreset: string | undefined, target: string, result: unknown) {
  await db.insert(aiGenerationsTable).values({
    id: randomUUID(),
    userId: getUserId(req),
    prompt,
    result: JSON.stringify(result),
    style: stylePreset ?? null,
    type: target,
  });
}

router.post("/ai/generate-outfit", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;

  const parsed = generateOutfitRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await buildOutfitResult(parsed.data);
    await saveGeneration(req, parsed.data.prompt, parsed.data.stylePreset, parsed.data.target, result);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
      req.log.error({ err }, "ai.generate-outfit.invalid-schema");
      sendSchemaError(res, err instanceof z.ZodError ? err.issues.map((i) => i.message).join(", ") : "AI returned non-JSON content");
      return;
    }
    req.log.error({ err }, "ai.generate-outfit.failed");
    res.status(500).json({ error: "Outfit generation failed. Please try again." });
  }
});

router.post("/ai/generate-variants", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;

  const parsed = generateVariantsRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const baseInput = parsed.data;
    const variants = await Promise.all(variantKinds.map(async (variant) => {
      const result = await buildOutfitResult(
        {
          prompt: baseInput.prompt,
          stylePreset: baseInput.stylePreset,
          target: baseInput.target,
        },
        `Variant mode: ${variant}. Keep core concept and palette family consistent while changing composition strength.`,
      );
      return { variant, result };
    }));

    const payload = generateVariantsResponseSchema.parse({ variants });
    await saveGeneration(req, parsed.data.prompt, parsed.data.stylePreset, `${parsed.data.target}:variants`, payload);
    res.json(payload);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
      req.log.error({ err }, "ai.generate-variants.invalid-schema");
      sendSchemaError(res, err instanceof z.ZodError ? err.issues.map((i) => i.message).join(", ") : "AI returned non-JSON content");
      return;
    }
    req.log.error({ err }, "ai.generate-variants.failed");
    res.status(500).json({ error: "Variant generation failed. Please try again." });
  }
});

router.post("/ai/remix-outfit", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;

  const parsed = remixOutfitRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const sourcePlan = parsed.data.source.concept;
    const result = await buildOutfitResult(
      {
        prompt: `${sourcePlan.title}. ${sourcePlan.overallMood}. ${parsed.data.instruction}`,
        target: sourcePlan.target,
        stylePreset: STYLE_PRESETS.find((preset) => preset.toLowerCase() === sourcePlan.style.toLowerCase()),
      },
      `Preserve core concept. Evolve this design instruction: ${parsed.data.instruction}`,
    );

    await saveGeneration(req, parsed.data.instruction, sourcePlan.style, `${sourcePlan.target}:remix`, result);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
      req.log.error({ err }, "ai.remix-outfit.invalid-schema");
      sendSchemaError(res, err instanceof z.ZodError ? err.issues.map((i) => i.message).join(", ") : "AI returned non-JSON content");
      return;
    }
    req.log.error({ err }, "ai.remix-outfit.failed");
    res.status(500).json({ error: "Remix failed. Please try again." });
  }
});

router.post("/ai/generate-listing", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;

  const parsed = listingRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Create a Roblox catalog listing. Return only JSON with title, description, tags.",
        },
        {
          role: "user",
          content: JSON.stringify(parsed.data.result.concept),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("AI_EMPTY_LISTING");

    const listing = listingResponseSchema.parse(parseJson(content));
    res.json(listing);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
      req.log.error({ err }, "ai.generate-listing.invalid-schema");
      sendSchemaError(res, err instanceof z.ZodError ? err.issues.map((i) => i.message).join(", ") : "AI returned non-JSON content");
      return;
    }
    req.log.error({ err }, "ai.generate-listing.failed");
    res.status(500).json({ error: "Listing generation failed. Please try again." });
  }
});

router.get("/ai/history", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;

  const rows = await db
    .select()
    .from(aiGenerationsTable)
    .where(eq(aiGenerationsTable.userId, getUserId(req)))
    .orderBy(desc(aiGenerationsTable.createdAt))
    .limit(30);

  const mapped = rows.flatMap((row: any) => {
    let payload: unknown;
    try {
      payload = JSON.parse(row.result);
    } catch {
      req.log.error({ generationId: row.id }, "ai.history.invalid-json");
      return [];
    }

    const parsed = generatedOutfitSchema.safeParse(payload);
    if (!parsed.success) return [];
    return [historyEntrySchema.parse({
      id: row.id,
      prompt: row.prompt,
      style: row.style,
      type: row.type,
      createdAt: row.createdAt.toISOString(),
      result: parsed.data,
    })];
  });

  res.json(mapped);
});

export default router;
