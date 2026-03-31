import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, aiGenerationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const STYLE_PRESETS: Record<string, string> = {
  streetwear: "Streetwear direction: bold urban layering, wearable graphics, and clean contrast panels for Roblox classic shirts.",
  anime: "Anime direction: expressive yet clean linework, stylized motifs, and balanced color blocking compatible with Roblox shirt regions.",
  cyberpunk: "Cyberpunk direction: futuristic paneling, neon accents, dark base tones, and subtle tech details.",
  y2k: "Y2K direction: glossy retro-futuristic cues, playful accents, and early-2000s inspired color combinations.",
  minimal: "Minimal direction: restrained palette, simple geometry, and premium clean composition.",
};

const robloxDesignSchema = z.object({
  title: z.string().min(1),
  style: z.string().min(1),
  colorPalette: z.array(z.string().min(1)).min(1),
  designElements: z.array(z.string().min(1)).min(1),
  placement: z.object({
    front: z.string().min(1),
    back: z.string().min(1),
    sleeves: z.string().min(1),
  }),
});

type RobloxDesign = z.infer<typeof robloxDesignSchema>;

const basePrompt = `You are a professional Roblox clothing designer.

Generate a Roblox classic shirt design.

Rules:
- Must fit Roblox shirt template
- Include front, back, sleeves
- Avoid copyrighted brands/logos
- Keep design clean and wearable
- Focus on style, colors, and placement

Return ONLY valid JSON with this structure:

{
  title: string,
  style: string,
  colorPalette: string[],
  designElements: string[],
  placement: {
    front: string,
    back: string,
    sleeves: string
  }
}`;

function parseStrictJson(rawContent: string): unknown {
  return JSON.parse(rawContent);
}

function sendValidationError(res: Response, details: string): void {
  res.status(422).json({
    error: "Invalid AI response schema",
    details,
  });
}

async function generateStructuredDesign(context: string): Promise<RobloxDesign> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1200,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: basePrompt },
      { role: "user", content: context },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error("AI_EMPTY_RESPONSE");
  }

  const parsed = parseStrictJson(rawContent);
  return robloxDesignSchema.parse(parsed);
}

router.post("/ai/generate-idea", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { prompt, style } = req.body;
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const styleContext = style ? STYLE_PRESETS[style] ?? `Style direction: ${style}` : "";

  try {
    const data = await generateStructuredDesign(
      `Task: Generate one production-quality Roblox shirt idea for this request: "${prompt}".\n${styleContext}`,
    );

    await db.insert(aiGenerationsTable).values({
      id: randomUUID(),
      userId: req.user.id,
      prompt,
      result: JSON.stringify(data),
      style: style ?? null,
      type: "shirt",
    });

    res.json({ data });
  } catch (err) {
    if (err instanceof SyntaxError) {
      sendValidationError(res, "AI returned non-JSON content.");
      return;
    }
    if (err instanceof z.ZodError) {
      sendValidationError(res, err.issues.map((issue) => issue.message).join(", "));
      return;
    }

    req.log.error({ err }, "AI generate-idea error");
    res.status(500).json({ error: "AI generation failed. Please try again." });
  }
});

router.post("/ai/improve-design", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { description, style } = req.body;
  if (!description || typeof description !== "string") {
    res.status(400).json({ error: "description is required" });
    return;
  }

  const styleContext = style ? STYLE_PRESETS[style] ?? `Style direction: ${style}` : "";

  try {
    const data = await generateStructuredDesign(
      `Task: Improve this Roblox shirt concept into a cleaner, more wearable, production-ready design: "${description}".\n${styleContext}`,
    );

    res.json({ data });
  } catch (err) {
    if (err instanceof SyntaxError) {
      sendValidationError(res, "AI returned non-JSON content.");
      return;
    }
    if (err instanceof z.ZodError) {
      sendValidationError(res, err.issues.map((issue) => issue.message).join(", "));
      return;
    }

    req.log.error({ err }, "AI improve-design error");
    res.status(500).json({ error: "Design improvement failed. Please try again." });
  }
});

router.post("/ai/generate-listing", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { idea, description, style } = req.body;
  if (!idea && !description) {
    res.status(400).json({ error: "idea or description is required" });
    return;
  }

  const source = [idea, description].filter(Boolean).join(". ");
  const styleContext = style ? STYLE_PRESETS[style] ?? `Style direction: ${style}` : "";

  try {
    const data = await generateStructuredDesign(
      `Task: Convert this concept into a market-ready Roblox design specification suitable for listing metadata and design execution: "${source}".\n${styleContext}`,
    );

    res.json({ data });
  } catch (err) {
    if (err instanceof SyntaxError) {
      sendValidationError(res, "AI returned non-JSON content.");
      return;
    }
    if (err instanceof z.ZodError) {
      sendValidationError(res, err.issues.map((issue) => issue.message).join(", "));
      return;
    }

    req.log.error({ err }, "AI generate-listing error");
    res.status(500).json({ error: "Listing generation failed. Please try again." });
  }
});

router.get("/ai/history", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const generations = await db
    .select()
    .from(aiGenerationsTable)
    .where(eq(aiGenerationsTable.userId, req.user.id))
    .orderBy(desc(aiGenerationsTable.createdAt))
    .limit(20);

  res.json(generations);
});

export default router;
