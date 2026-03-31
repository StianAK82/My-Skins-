import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, projectsTable, aiGenerationsTable } from "@workspace/db";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const STYLE_PRESETS: Record<string, string> = {
  streetwear: "urban streetwear with bold graphics, graffiti elements, oversized silhouettes, and city-inspired colors",
  anime: "anime-inspired with vibrant colors, Japanese aesthetic, manga-style details, and pastel or neon schemes",
  cyberpunk: "cyberpunk futuristic with neon colors (cyan, magenta, yellow), circuit patterns, digital glitch effects, dark base",
  y2k: "Y2K aesthetic with metallic sheen, holographic effects, butterfly motifs, silver, pink, and sky blue palette",
  minimal: "minimalist with clean lines, simple geometric patterns, neutral palette of white, black, and grey",
  fantasy: "fantasy-themed with mystical elements, magical runes, enchanted motifs, deep purple, emerald, and gold",
};

const ITEM_TYPE_MAP: Record<string, { robloxType: "shirt" | "pants"; label: string }> = {
  shirt: { robloxType: "shirt", label: "classic shirt" },
  pants: { robloxType: "pants", label: "classic pants" },
  hoodie: { robloxType: "shirt", label: "hoodie" },
  jacket: { robloxType: "shirt", label: "jacket" },
  uniform: { robloxType: "shirt", label: "uniform" },
  tshirt: { robloxType: "shirt", label: "t-shirt" },
  suit: { robloxType: "shirt", label: "suit" },
  vest: { robloxType: "shirt", label: "vest" },
};

function getLanguageInstruction(language?: string): string {
  const map: Record<string, string> = {
    no: "Respond entirely in Norwegian (Bokmål).",
    es: "Respond entirely in Spanish.",
  };
  return map[language ?? ""] ?? "Respond in English.";
}

router.post("/ai/quick-create", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { prompt, itemType = "shirt", style, language } = req.body;
  if (!prompt?.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const mapped = ITEM_TYPE_MAP[itemType] ?? ITEM_TYPE_MAP.shirt;
  const styleDesc = style ? STYLE_PRESETS[style] ?? style : "";
  const langInstruction = getLanguageInstruction(language);

  let concept: Record<string, unknown> = {};

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a world-class Roblox clothing designer creating Roblox ${mapped.label} textures. ${langInstruction} Always respond with valid JSON only. No markdown, no code blocks — just the raw JSON object.`,
        },
        {
          role: "user",
          content: `Create a detailed Roblox ${mapped.label} design from this description: "${prompt}"${styleDesc ? `\nStyle direction: ${styleDesc}` : ""}

Return this exact JSON structure:
{
  "title": "A catchy, marketable design name (max 40 chars)",
  "concept": "One vivid sentence describing the design",
  "description": "Rich 2-3 paragraph design description with visual details, texture feel, and how it looks on a Roblox character",
  "mood": "Overall vibe (e.g. edgy, mystical, playful)",
  "style": "${style || "custom"}",
  "primaryColor": "#XXXXXX",
  "backgroundColor": "#XXXXXX",
  "colors": [
    {"hex": "#XXXXXX", "name": "Name", "role": "primary"},
    {"hex": "#XXXXXX", "name": "Name", "role": "accent"},
    {"hex": "#XXXXXX", "name": "Name", "role": "shadow"},
    {"hex": "#XXXXXX", "name": "Name", "role": "highlight"},
    {"hex": "#XXXXXX", "name": "Name", "role": "base"}
  ],
  "keyElements": ["visual element 1", "element 2", "element 3", "element 4", "element 5"],
  "designTips": ["Roblox-specific tip 1", "tip 2", "tip 3"],
  "suggestedTags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    concept = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch (err) {
    req.log.error({ err }, "AI quick-create concept generation error");
    concept = {
      title: prompt.split(" ").slice(0, 4).join(" "),
      concept: prompt,
      description: prompt,
      colors: [{ hex: "#3b82f6", name: "Blue", role: "primary" }],
      backgroundColor: "#ffffff",
      primaryColor: "#3b82f6",
      suggestedTags: [],
    };
  }

  const title = (concept.title as string) || `${prompt.split(" ").slice(0, 3).join(" ")} ${mapped.label}`;
  const tags = (concept.suggestedTags as string[]) || [];
  const bgColor = (concept.backgroundColor as string) || "#ffffff";

  const fabricInitialCanvas = JSON.stringify({
    version: "6.0.0",
    objects: [],
    background: bgColor,
    __aiConcept: concept,
    __itemLabel: mapped.label,
    __originalPrompt: prompt,
  });

  const [project] = await db.insert(projectsTable).values({
    id: randomUUID(),
    userId: req.user.id,
    title: title.slice(0, 100),
    type: mapped.robloxType,
    isAiGenerated: true,
    tags,
    canvasData: fabricInitialCanvas,
  }).returning();

  await db.insert(aiGenerationsTable).values({
    id: randomUUID(),
    userId: req.user.id,
    prompt,
    result: JSON.stringify(concept),
    style: style ?? null,
    type: mapped.robloxType,
  });

  res.status(201).json({
    projectId: project.id,
    title: project.title,
    type: project.type,
    itemLabel: mapped.label,
    concept,
  });
});

export default router;
