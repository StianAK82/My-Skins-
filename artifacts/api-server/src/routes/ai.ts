import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, aiGenerationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const STYLE_PRESETS: Record<string, string> = {
  streetwear: "urban streetwear with bold graphics, graffiti elements, oversized silhouettes, and city-inspired colors like black, white, red, and gold",
  anime: "anime-inspired with vibrant colors, Japanese aesthetic, manga-style details, sakura motifs, and pastel or neon color schemes",
  cyberpunk: "cyberpunk futuristic with neon colors (cyan, magenta, yellow), tech circuit patterns, digital glitch effects, and dark base tones",
  y2k: "Y2K aesthetic with metallic sheen, holographic effects, butterfly motifs, low-rise styling, and early 2000s color palette of silver, pink, and sky blue",
  minimal: "minimalist with clean lines, simple geometric patterns, neutral palette (white, black, grey), and restrained detail",
  fantasy: "fantasy-themed with mystical elements, magical runes, enchanted forest motifs, and rich colors like deep purple, emerald, and gold",
};

function getLanguageInstruction(language?: string): string {
  const langMap: Record<string, string> = {
    no: "Respond entirely in Norwegian (Bokmål).",
    es: "Respond entirely in Spanish.",
    en: "Respond in English.",
  };
  return langMap[language ?? "en"] ?? "Respond in English.";
}

router.post("/ai/generate", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { prompt, type, style, language } = req.body;
  if (!prompt || !type) {
    res.status(400).json({ error: "prompt and type are required" });
    return;
  }

  const styleDesc = style ? STYLE_PRESETS[style] ?? style : "";
  const itemType = type === "pants" ? "Roblox classic pants" : "Roblox classic shirt";
  const langInstruction = getLanguageInstruction(language);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a Roblox clothing design expert. You help creators design ${itemType} textures. ${langInstruction} Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Design a ${itemType} based on: "${prompt}"${styleDesc ? `. Style: ${styleDesc}` : ""}.

Return a JSON object with:
{
  "concept": "One sentence summarizing the design concept",
  "description": "2-3 paragraph detailed design description including layout, elements, and how it would look in Roblox",
  "colors": [{"hex": "#XXXXXX", "name": "Color Name", "usage": "What this color is used for"}, ...] (5 colors),
  "style": "Style category name",
  "keyElements": ["element1", "element2", ...] (5 key design elements),
  "tips": ["tip1", "tip2", "tip3"] (3 Roblox-specific design tips),
  "suggestedTitle": "A catchy Roblox marketplace title",
  "suggestedTags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = { description: rawContent };
    }

    const [generation] = await db.insert(aiGenerationsTable).values({
      id: randomUUID(),
      userId: req.user.id,
      prompt,
      result: JSON.stringify(parsed),
      style: style ?? null,
      type,
    }).returning();

    res.json({
      id: generation.id,
      prompt: generation.prompt,
      result: parsed,
      createdAt: generation.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "AI generate error");
    res.status(500).json({ error: "AI generation failed. Please try again." });
  }
});

router.post("/ai/generate-idea", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { prompt, style, language } = req.body;
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const styleDesc = style ? STYLE_PRESETS[style] ?? style : "";
  const langInstruction = getLanguageInstruction(language);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a creative Roblox clothing designer. You generate detailed, actionable design ideas for Roblox shirts and pants. ${langInstruction} Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Generate a detailed Roblox clothing design idea for: "${prompt}"${styleDesc ? `. Style direction: ${styleDesc}` : ""}.

Return a JSON object:
{
  "idea": "Catchy, creative name for this design",
  "concept": "One-sentence design concept",
  "description": "Detailed description of the design (what it looks like, visual elements, textures)",
  "colors": [{"hex": "#XXXXXX", "name": "Color Name", "role": "primary/accent/shadow/highlight/base"}],
  "style": "${style || "custom"}",
  "mood": "The overall vibe/mood (e.g. edgy, playful, mysterious)",
  "inspiration": "Real-world inspiration (artist, movement, culture)",
  "elements": ["key visual element 1", "element 2", "element 3", "element 4"],
  "gradient": false
}`,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = { idea: prompt, description: rawContent };
    }

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "AI generate-idea error");
    res.status(500).json({ error: "AI idea generation failed. Please try again." });
  }
});

router.post("/ai/generate-listing", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { idea, description, style, type, language } = req.body;
  if (!idea && !description) {
    res.status(400).json({ error: "idea or description is required" });
    return;
  }

  const langInstruction = getLanguageInstruction(language);
  const itemType = type === "pants" ? "Roblox pants" : "Roblox shirt";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a Roblox marketplace listing expert. You write compelling titles, descriptions, and tags that help clothing sell. ${langInstruction} Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Create a Roblox marketplace listing for this ${itemType}:
Design: "${idea || ""}"
Details: "${description || ""}"
Style: "${style || "custom"}"

Return a JSON object:
{
  "title": "Compelling marketplace title (max 40 chars)",
  "description": "Engaging 2-3 sentence description that sells the item",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "category": "Shirts or Pants",
  "priceRange": "Suggested Robux price range (e.g. '5-15 Robux')",
  "targetAudience": "Who would wear this (e.g. 'Anime fans, role-players')"
}`,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = { title: idea, description: rawContent };
    }

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "AI generate-listing error");
    res.status(500).json({ error: "Listing generation failed. Please try again." });
  }
});

router.post("/ai/improve", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { description, style, type, language } = req.body;
  if (!description) {
    res.status(400).json({ error: "description is required" });
    return;
  }

  const langInstruction = getLanguageInstruction(language);
  const itemType = type === "pants" ? "Roblox pants" : "Roblox shirt";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a senior Roblox clothing designer and art director. You review existing designs and suggest specific, actionable improvements. ${langInstruction} Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Review and improve this ${itemType} design:
"${description}"
${style ? `Current style: ${style}` : ""}

Return a JSON object:
{
  "overall": "Brief overall assessment (1-2 sentences)",
  "score": 7,
  "improvements": [
    {"area": "Color", "issue": "Current problem", "fix": "Specific fix suggestion"},
    {"area": "Composition", "issue": "...", "fix": "..."},
    {"area": "Style", "issue": "...", "fix": "..."},
    {"area": "Detail", "issue": "...", "fix": "..."}
  ],
  "revisedDescription": "A rewritten, improved version of the design description",
  "colorFixes": [{"hex": "#XXXXXX", "name": "Name", "replaces": "What it replaces"}],
  "nextSteps": ["step1", "step2", "step3"]
}`,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = { overall: rawContent };
    }

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "AI improve error");
    res.status(500).json({ error: "Design improvement failed. Please try again." });
  }
});

router.post("/ai/palette", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { prompt, style, language } = req.body;
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const styleDesc = style ? STYLE_PRESETS[style] ?? style : "";
  const langInstruction = getLanguageInstruction(language);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a color theory expert specializing in Roblox clothing design. ${langInstruction} Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: `Create a color palette for: "${prompt}"${styleDesc ? `. Style: ${styleDesc}` : ""}.

Return a JSON object:
{
  "name": "Creative palette name",
  "description": "One-sentence description of the palette mood",
  "colors": [
    {"hex": "#XXXXXX", "name": "Color Name", "role": "primary/accent/shadow/highlight/neutral"},
    {"hex": "#XXXXXX", "name": "Color Name", "role": "..."},
    {"hex": "#XXXXXX", "name": "Color Name", "role": "..."},
    {"hex": "#XXXXXX", "name": "Color Name", "role": "..."},
    {"hex": "#XXXXXX", "name": "Color Name", "role": "..."}
  ],
  "usage": "How to use this palette in a design"
}`,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = { name: prompt, colors: [] };
    }

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "AI palette error");
    res.status(500).json({ error: "Palette generation failed. Please try again." });
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
