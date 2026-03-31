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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

function contrastText(bg: string): string {
  return luminance(bg) > 0.5 ? "#1a1a1a" : "#ffffff";
}

function makeUuid() { return randomUUID(); }

function buildShirtCanvas(
  title: string,
  colors: Array<{ hex: string; name: string; role?: string }>,
  primaryColor: string,
  bgColor: string,
): object {
  const W = 1024;
  const H = 512;
  const accent1 = colors[1]?.hex ?? "#ffffff";
  const accent2 = colors[2]?.hex ?? primaryColor;
  const accent3 = colors[3]?.hex ?? accent1;

  const objects: object[] = [
    // Full background
    {
      type: "rect",
      version: "6.0.0",
      originX: "left", originY: "top",
      left: 0, top: 0,
      width: W, height: H,
      fill: bgColor,
      stroke: null, strokeWidth: 0,
      opacity: 1, selectable: false, evented: false,
    },
    // Top horizontal stripe
    {
      type: "rect",
      version: "6.0.0",
      originX: "left", originY: "top",
      left: 0, top: 0,
      width: W, height: 48,
      fill: primaryColor,
      stroke: null, strokeWidth: 0,
      opacity: 1,
    },
    // Left vertical bar
    {
      type: "rect",
      version: "6.0.0",
      originX: "left", originY: "top",
      left: 0, top: 48,
      width: 64, height: H - 48,
      fill: primaryColor,
      stroke: null, strokeWidth: 0,
      opacity: 0.85,
    },
    // Right vertical bar
    {
      type: "rect",
      version: "6.0.0",
      originX: "left", originY: "top",
      left: W - 64, top: 48,
      width: 64, height: H - 48,
      fill: primaryColor,
      stroke: null, strokeWidth: 0,
      opacity: 0.85,
    },
    // Center accent rectangle
    {
      type: "rect",
      version: "6.0.0",
      originX: "center", originY: "center",
      left: W / 2, top: H / 2 + 20,
      width: 340, height: 120,
      fill: accent1,
      stroke: accent2, strokeWidth: 3,
      rx: 8, ry: 8,
      opacity: 0.9,
    },
    // Bottom stripe
    {
      type: "rect",
      version: "6.0.0",
      originX: "left", originY: "top",
      left: 0, top: H - 36,
      width: W, height: 36,
      fill: accent2,
      stroke: null, strokeWidth: 0,
      opacity: 0.9,
    },
    // Accent dot left
    {
      type: "circle",
      version: "6.0.0",
      originX: "center", originY: "center",
      left: 130, top: H / 2 + 20,
      radius: 36,
      fill: accent3,
      stroke: accent1, strokeWidth: 2,
      opacity: 0.8,
    },
    // Accent dot right
    {
      type: "circle",
      version: "6.0.0",
      originX: "center", originY: "center",
      left: W - 130, top: H / 2 + 20,
      radius: 36,
      fill: accent3,
      stroke: accent1, strokeWidth: 2,
      opacity: 0.8,
    },
    // Design title text (top bar)
    {
      type: "i-text",
      version: "6.0.0",
      originX: "center", originY: "center",
      left: W / 2, top: 24,
      text: title.toUpperCase(),
      fontSize: 22,
      fontFamily: "Arial Black, Impact, sans-serif",
      fontWeight: "bold",
      fill: contrastText(primaryColor),
      stroke: null, strokeWidth: 0,
      opacity: 1,
    },
    // Design label in center rectangle
    {
      type: "i-text",
      version: "6.0.0",
      originX: "center", originY: "center",
      left: W / 2, top: H / 2 + 20,
      text: title,
      fontSize: 20,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: "bold",
      fill: contrastText(accent1),
      stroke: null, strokeWidth: 0,
      opacity: 1,
    },
  ];

  return {
    version: "6.0.0",
    objects,
    background: bgColor,
  };
}

function buildPantsCanvas(
  title: string,
  colors: Array<{ hex: string; name: string; role?: string }>,
  primaryColor: string,
  bgColor: string,
): object {
  const W = 585;
  const H = 559;
  const accent1 = colors[1]?.hex ?? "#ffffff";
  const accent2 = colors[2]?.hex ?? primaryColor;

  const objects: object[] = [
    // Full background
    {
      type: "rect",
      version: "6.0.0",
      originX: "left", originY: "top",
      left: 0, top: 0, width: W, height: H,
      fill: bgColor,
      stroke: null, strokeWidth: 0,
      opacity: 1, selectable: false, evented: false,
    },
    // Left leg panel
    {
      type: "rect",
      version: "6.0.0",
      originX: "left", originY: "top",
      left: 0, top: 0, width: W / 2 - 2, height: H,
      fill: primaryColor,
      stroke: null, strokeWidth: 0,
      opacity: 0.85,
    },
    // Right leg panel (slightly lighter)
    {
      type: "rect",
      version: "6.0.0",
      originX: "left", originY: "top",
      left: W / 2 + 2, top: 0, width: W / 2 - 2, height: H,
      fill: primaryColor,
      stroke: null, strokeWidth: 0,
      opacity: 0.7,
    },
    // Center seam accent
    {
      type: "rect",
      version: "6.0.0",
      originX: "center", originY: "top",
      left: W / 2, top: 0, width: 4, height: H,
      fill: accent1,
      stroke: null, strokeWidth: 0,
      opacity: 0.9,
    },
    // Bottom accent stripe left
    {
      type: "rect",
      version: "6.0.0",
      originX: "left", originY: "top",
      left: 0, top: H - 40, width: W / 2 - 2, height: 40,
      fill: accent2,
      stroke: null, strokeWidth: 0,
      opacity: 1,
    },
    // Bottom accent stripe right
    {
      type: "rect",
      version: "6.0.0",
      originX: "left", originY: "top",
      left: W / 2 + 2, top: H - 40, width: W / 2 - 2, height: 40,
      fill: accent2,
      stroke: null, strokeWidth: 0,
      opacity: 1,
    },
    // Design title text
    {
      type: "i-text",
      version: "6.0.0",
      originX: "center", originY: "center",
      left: W / 4, top: H / 2,
      text: title.split(" ").join("\n"),
      fontSize: 18,
      fontFamily: "Arial Black, Impact, sans-serif",
      fontWeight: "bold",
      fill: contrastText(primaryColor),
      textAlign: "center",
      stroke: null, strokeWidth: 0,
      opacity: 1,
    },
  ];

  return {
    version: "6.0.0",
    objects,
    background: bgColor,
  };
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
      colors: [
        { hex: "#3b82f6", name: "Blue", role: "primary" },
        { hex: "#ffffff", name: "White", role: "accent" },
        { hex: "#1e3a5f", name: "Dark Blue", role: "shadow" },
        { hex: "#60a5fa", name: "Light Blue", role: "highlight" },
        { hex: "#0f172a", name: "Navy", role: "base" },
      ],
      backgroundColor: "#1e3a5f",
      primaryColor: "#3b82f6",
      suggestedTags: [],
    };
  }

  const title = (concept.title as string) || `${prompt.split(" ").slice(0, 3).join(" ")} ${mapped.label}`;
  const tags = (concept.suggestedTags as string[]) || [];
  const colors = (concept.colors as Array<{ hex: string; name: string; role?: string }>) || [];
  const primaryColor = (concept.primaryColor as string) || colors[0]?.hex || "#3b82f6";
  const bgColor = (concept.backgroundColor as string) || "#1e3a5f";

  // Build actual Fabric.js canvas with visual content
  const fabricCanvas = mapped.robloxType === "pants"
    ? buildPantsCanvas(title, colors, primaryColor, bgColor)
    : buildShirtCanvas(title, colors, primaryColor, bgColor);

  // Attach AI metadata to the canvas JSON for the editor to use
  const fabricInitialCanvas = JSON.stringify({
    ...fabricCanvas,
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
