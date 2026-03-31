import { Router, type IRouter } from "express";
import { db, aiGenerationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const STYLE_DESCRIPTIONS: Record<string, string> = {
  streetwear: "urban streetwear style with bold graphics, graffiti elements, and city-inspired colors",
  anime: "anime-inspired style with vibrant colors, Japanese aesthetic, and manga-style details",
  cyber: "cyberpunk/futuristic style with neon colors, tech patterns, and digital glitch effects",
  fantasy: "fantasy-themed style with mystical elements, magical patterns, and enchanted colors",
  minimal: "minimalist style with clean lines, simple geometric patterns, and neutral color palette",
  retro: "retro/vintage style with throwback graphics, nostalgic patterns, and classic color schemes",
};

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

  const styleDesc = style ? STYLE_DESCRIPTIONS[style] ?? style : "";
  const itemType = type === "pants" ? "Roblox classic pants" : "Roblox classic shirt";

  const designResult = `Design concept for ${itemType}${styleDesc ? ` in ${styleDesc}` : ""}:

Concept: "${prompt}"

Color Palette:
- Primary: Electric blue with deep navy base
- Accent: White highlights and silver metallic details
- Shadow: Dark charcoal for depth

Key Design Elements:
${styleDesc ? `- Style direction: ${styleDesc}` : ""}
- Main pattern: Abstract geometric shapes inspired by the prompt
- Texture: Layered with gradient overlays for depth
- Details: Fine linework for definition, bold blocks for impact

Layout for ${itemType}:
- Front: Centered focal design with the main concept
- Back: Mirrored or complementary pattern
- Sleeves/sides: Repeating accent pattern

Design Tips:
- Keep the main design within the safe zone (center 80% of the template)
- Use high contrast for visibility in-game
- Consider how it looks at small sizes (game character scale)

Suggested color codes: #1E40AF, #3B82F6, #DBEAFE, #0F172A, #F8FAFC`;

  const suggestedTitle = `${prompt.split(" ").slice(0, 3).join(" ")} ${type === "pants" ? "Pants" : "Shirt"}`;
  const suggestedTags = [style ?? "custom", type, "original", prompt.split(" ")[0]?.toLowerCase() ?? "design"].filter(Boolean);

  const [generation] = await db.insert(aiGenerationsTable).values({
    id: randomUUID(),
    userId: req.user.id,
    prompt,
    result: designResult,
    style: style ?? null,
    type,
  }).returning();

  res.json({
    id: generation.id,
    prompt: generation.prompt,
    result: generation.result,
    suggestedTitle,
    suggestedTags,
    createdAt: generation.createdAt,
  });
});

router.post("/ai/palette", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { prompt, style } = req.body;
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const palettes: Record<string, { colors: string[]; name: string; description: string }> = {
    cyber: {
      colors: ["#00FFFF", "#FF00FF", "#0A0A2E", "#1A1A4E", "#FFFFFF"],
      name: "Neon Cyber",
      description: "Electric neons on deep dark base for a cyberpunk feel",
    },
    anime: {
      colors: ["#FF6B9D", "#C44D8A", "#FFE0ED", "#2D1B69", "#F7F7FF"],
      name: "Sakura Dream",
      description: "Soft pinks and deep purples inspired by anime aesthetics",
    },
    streetwear: {
      colors: ["#1A1A1A", "#FF4500", "#FFFFFF", "#FFD700", "#333333"],
      name: "Street Heat",
      description: "Bold contrast with warm accents for urban edge",
    },
    fantasy: {
      colors: ["#7B2D8B", "#C9A227", "#1B4332", "#E8D5B7", "#4A0E8F"],
      name: "Arcane Forest",
      description: "Mystical purples and golds with deep greens",
    },
    minimal: {
      colors: ["#FFFFFF", "#000000", "#E5E5E5", "#333333", "#999999"],
      name: "Pure Minimal",
      description: "Clean monochromatic palette for timeless simplicity",
    },
  };

  const palette = palettes[style ?? ""] ?? {
    colors: ["#2563EB", "#1E40AF", "#DBEAFE", "#0F172A", "#F8FAFC"],
    name: `${prompt} Palette`,
    description: `Custom color palette inspired by "${prompt}"`,
  };

  res.json(palette);
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
