import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { openai } from "@workspace/integrations-openai-ai-server";
import { aiGenerationsTable, db } from "@workspace/db";
import {
  aiDesignSchema,
  aiGenerateRequestSchema,
  aiIdeaSchema,
  aiImproveRequestSchema,
  aiLayoutSchema,
  aiModulesSchema,
  aiPaletteSchema,
  validatePlacementForItemType,
} from "../lib/ai-contracts";

const router: IRouter = Router();

const historyEntrySchema = z.object({
  id: z.string(),
  prompt: z.string(),
  style: z.string().nullable(),
  type: z.string().nullable(),
  createdAt: z.string(),
  result: aiDesignSchema,
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

function parseStrictJson(content: string): unknown {
  return JSON.parse(content);
}

function schema422(res: Response, err: z.ZodError | SyntaxError) {
  res.status(422).json({
    error: "Invalid AI response schema",
    details: err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) : ["AI returned non-JSON content"],
  });
}

async function askModel<T extends z.ZodTypeAny>(prompt: string, schema: T): Promise<z.infer<T>> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are the My Skins structured Roblox design engine.",
          "Always return JSON only.",
          "No brand logos. No copyrighted characters. No unsafe content.",
          "Design for Roblox classic clothing with wearable placement clarity.",
        ].join(" "),
      },
      { role: "user", content: prompt },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new SyntaxError("AI returned empty content");
  }

  return schema.parse(parseStrictJson(content));
}

function buildGeneratePrompt(input: z.infer<typeof aiGenerateRequestSchema>, mode: "generate" | "idea" | "palette" | "modules" | "layout") {
  return [
    `mode: ${mode}`,
    `itemType: ${input.itemType}`,
    `target: roblox`,
    `prompt: ${input.prompt}`,
    input.style ? `style: ${input.style}` : "",
    input.theme ? `theme: ${input.theme}` : "",
    "Placement rule: classic_shirt uses sleeves and marks legs as not_used. classic_pants uses legs and marks sleeves as not_used.",
  ].filter(Boolean).join("\n");
}

function enforcePlacement(payload: z.infer<typeof aiDesignSchema>): z.infer<typeof aiDesignSchema> {
  if (!validatePlacementForItemType(payload)) {
    throw new z.ZodError([{
      code: "custom",
      message: "Invalid itemType placement mapping",
      path: ["placement"],
    }]);
  }
  return payload;
}

async function saveGeneration(req: Request, prompt: string, type: string, result: unknown) {
  await db.insert(aiGenerationsTable).values({
    id: randomUUID(),
    userId: getUserId(req),
    prompt,
    result: JSON.stringify(result),
    type,
    style: null,
  });
}

router.post("/ai/generate", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = enforcePlacement(await askModel(buildGeneratePrompt(parsed.data, "generate"), aiDesignSchema));
    await saveGeneration(req, parsed.data.prompt, "generate", result);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(res, err);
    req.log.error({ err }, "ai.generate.failed");
    res.status(500).json({ error: "AI generation failed" });
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
    const result = await askModel(buildGeneratePrompt(parsed.data, "idea"), aiIdeaSchema);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(res, err);
    req.log.error({ err }, "ai.generate-idea.failed");
    res.status(500).json({ error: "AI idea generation failed" });
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
    const prompt = `Improve this design with instruction: ${parsed.data.instruction}\nsource:${JSON.stringify(parsed.data.design)}`;
    const result = enforcePlacement(await askModel(prompt, aiDesignSchema));
    await saveGeneration(req, parsed.data.instruction, "improve", result);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(res, err);
    req.log.error({ err }, "ai.improve.failed");
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
    const prompt = `Remix this design while preserving core style: ${parsed.data.instruction}\nsource:${JSON.stringify(parsed.data.design)}`;
    const result = enforcePlacement(await askModel(prompt, aiDesignSchema));
    await saveGeneration(req, parsed.data.instruction, "remix", result);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(res, err);
    req.log.error({ err }, "ai.remix.failed");
    res.status(500).json({ error: "AI remix failed" });
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
    const result = await askModel(buildGeneratePrompt(parsed.data, "modules"), aiModulesSchema);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(res, err);
    req.log.error({ err }, "ai.generate-modules.failed");
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
    const result = await askModel(buildGeneratePrompt(parsed.data, "palette"), aiPaletteSchema);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(res, err);
    req.log.error({ err }, "ai.generate-palette.failed");
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
    const result = await askModel(buildGeneratePrompt(parsed.data, "layout"), aiLayoutSchema);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(res, err);
    req.log.error({ err }, "ai.generate-layout.failed");
    res.status(500).json({ error: "AI layout generation failed" });
  }
});

router.post("/ai/generate-outfit", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiGenerateRequestSchema.safeParse({
    prompt: req.body?.prompt,
    itemType: req.body?.target,
    style: req.body?.stylePreset,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const design = enforcePlacement(await askModel(buildGeneratePrompt(parsed.data, "generate"), aiDesignSchema));
    const legacy = {
      concept: {
        title: design.title,
        style: design.style,
        baseColor: design.colorPalette[0],
        colorPalette: design.colorPalette,
        front: { description: design.placement.front },
        back: { description: design.placement.back },
        leftSleeve: { description: design.placement.leftSleeve },
        rightSleeve: { description: design.placement.rightSleeve },
      },
      assets: {
        frontImage: null,
        backImage: null,
        leftSleeveImage: null,
        rightSleeveImage: null,
      },
    };
    res.json(legacy);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(res, err);
    req.log.error({ err }, "ai.generate-outfit.failed");
    res.status(500).json({ error: "Outfit generation failed" });
  }
});

router.post("/ai/remix-outfit", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;
  const parsed = aiImproveRequestSchema.safeParse({
    instruction: req.body?.instruction,
    design: req.body?.source,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const design = enforcePlacement(await askModel(`Remix this design: ${parsed.data.instruction}\n${JSON.stringify(parsed.data.design)}`, aiDesignSchema));
    const legacy = {
      concept: {
        title: design.title,
        style: design.style,
        baseColor: design.colorPalette[0],
        colorPalette: design.colorPalette,
        front: { description: design.placement.front },
        back: { description: design.placement.back },
        leftSleeve: { description: design.placement.leftSleeve },
        rightSleeve: { description: design.placement.rightSleeve },
      },
      assets: {
        frontImage: null,
        backImage: null,
        leftSleeveImage: null,
        rightSleeveImage: null,
      },
    };
    res.json(legacy);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return schema422(res, err);
    req.log.error({ err }, "ai.remix-outfit.failed");
    res.status(500).json({ error: "Remix failed" });
  }
});

router.get("/ai/history", async (req, res): Promise<void> => {
  if (!ensureAuthenticated(req, res)) return;

  const rows = await db.select().from(aiGenerationsTable)
    .where(eq(aiGenerationsTable.userId, getUserId(req)))
    .orderBy(desc(aiGenerationsTable.createdAt))
    .limit(30);

  const mapped = rows.flatMap((row: any) => {
    try {
      const payload = aiDesignSchema.parse(JSON.parse(row.result));
      return [historyEntrySchema.parse({
        id: row.id,
        prompt: row.prompt,
        style: row.style,
        type: row.type,
        createdAt: row.createdAt.toISOString(),
        result: payload,
      })];
    } catch {
      return [];
    }
  });

  res.json(mapped);
});

export default router;
