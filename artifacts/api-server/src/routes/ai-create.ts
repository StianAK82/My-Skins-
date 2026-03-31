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
  shirt:   { robloxType: "shirt",  label: "classic shirt" },
  pants:   { robloxType: "pants",  label: "classic pants" },
  hoodie:  { robloxType: "shirt",  label: "hoodie" },
  jacket:  { robloxType: "shirt",  label: "jacket" },
  uniform: { robloxType: "shirt",  label: "uniform" },
  tshirt:  { robloxType: "shirt",  label: "t-shirt" },
  suit:    { robloxType: "shirt",  label: "suit" },
  vest:    { robloxType: "shirt",  label: "vest" },
};

function getLanguageInstruction(language?: string): string {
  const map: Record<string, string> = {
    no: "All text fields (title, concept, description, etc.) must be in Norwegian (Bokmål). Only displayText must be exact as the user wrote it (usually in English for Roblox).",
    es: "All text fields must be in Spanish. Only displayText must be exact as the user wrote it.",
  };
  return map[language ?? ""] ?? "Respond in English.";
}

function luminance(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 0.5;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function contrastText(bg: string): string {
  return luminance(bg) > 0.55 ? "#111111" : "#ffffff";
}

interface AiConcept {
  title?: string;
  displayText?: string;
  textStyle?: string;
  concept?: string;
  description?: string;
  mood?: string;
  style?: string;
  primaryColor?: string;
  backgroundColor?: string;
  colors?: Array<{ hex: string; name: string; role?: string }>;
  keyElements?: string[];
  designTips?: string[];
  suggestedTags?: string[];
}

/**
 * Roblox classic clothing template = 585×559 px for BOTH shirt and pants.
 * This is the official template size required for avatar wearability.
 */
const ROBLOX_W = 585;
const ROBLOX_H = 559;

function buildCanvas(
  concept: AiConcept,
  originalPrompt: string,
  itemType: "shirt" | "pants",
): object {
  const W = ROBLOX_W;
  const H = ROBLOX_H;

  const colors = concept.colors ?? [];
  const bg      = concept.backgroundColor ?? "#1a1a2e";
  const primary = concept.primaryColor ?? colors[0]?.hex ?? "#3b82f6";
  const accent1 = colors[1]?.hex ?? "#ffffff";
  const accent2 = colors[2]?.hex ?? primary;
  const accent3 = colors[3]?.hex ?? accent1;

  // displayText = what the user wants written on the garment, or the title
  const rawDisplay = (concept.displayText ?? concept.title ?? originalPrompt).trim();
  // Split into lines if multi-word (max 2 words per line)
  const words = rawDisplay.split(/\s+/);
  const displayText = words.length > 2
    ? words.slice(0, Math.ceil(words.length / 2)).join(" ") + "\n" + words.slice(Math.ceil(words.length / 2)).join(" ")
    : rawDisplay;

  const textStyle = (concept.textStyle ?? "bold").toLowerCase();
  const isGraffiti = textStyle.includes("graffiti") || textStyle.includes("street") || textStyle.includes("bold");
  const textColor = contrastText(primary);

  // Graffiti / bold outline style
  const titleFontSize = rawDisplay.length <= 8 ? 80 : rawDisplay.length <= 14 ? 60 : 44;
  const titleStrokeW  = isGraffiti ? 6 : 3;
  const titleStroke   = isGraffiti ? accent1 : "transparent";

  const objects: object[] = [];

  // ── 1. Full background fill
  objects.push({
    type: "rect", version: "6.0.0",
    originX: "left", originY: "top",
    left: 0, top: 0, width: W, height: H,
    fill: bg, stroke: null, strokeWidth: 0,
    opacity: 1, selectable: false, evented: false,
  });

  if (itemType === "shirt") {
    // ── 2. Chest gradient panel (front torso area)
    objects.push({
      type: "rect", version: "6.0.0",
      originX: "left", originY: "top",
      left: Math.floor(W * 0.08), top: Math.floor(H * 0.1),
      width: Math.floor(W * 0.84), height: Math.floor(H * 0.55),
      fill: primary, stroke: null, strokeWidth: 0,
      rx: 6, ry: 6, opacity: 0.92,
    });

    // ── 3. Top collar bar
    objects.push({
      type: "rect", version: "6.0.0",
      originX: "left", originY: "top",
      left: 0, top: 0, width: W, height: 28,
      fill: accent2, stroke: null, strokeWidth: 0, opacity: 1,
    });

    // ── 4. Bottom hem bar
    objects.push({
      type: "rect", version: "6.0.0",
      originX: "left", originY: "top",
      left: 0, top: H - 32, width: W, height: 32,
      fill: accent2, stroke: null, strokeWidth: 0, opacity: 1,
    });

    // ── 5. Left sleeve accent
    objects.push({
      type: "rect", version: "6.0.0",
      originX: "left", originY: "top",
      left: 0, top: 28, width: Math.floor(W * 0.07), height: Math.floor(H * 0.45),
      fill: accent3, stroke: null, strokeWidth: 0, opacity: 0.9,
    });

    // ── 6. Right sleeve accent
    objects.push({
      type: "rect", version: "6.0.0",
      originX: "left", originY: "top",
      left: W - Math.floor(W * 0.07), top: 28,
      width: Math.floor(W * 0.07), height: Math.floor(H * 0.45),
      fill: accent3, stroke: null, strokeWidth: 0, opacity: 0.9,
    });

    // ── 7. MAIN DISPLAY TEXT (graffiti/bold — centred on chest)
    objects.push({
      type: "i-text", version: "6.0.0",
      originX: "center", originY: "center",
      left: W / 2, top: Math.floor(H * 0.37),
      text: displayText,
      fontSize: titleFontSize,
      fontFamily: "Impact, Arial Black, 'Arial Narrow', sans-serif",
      fontWeight: "900",
      fontStyle: "normal",
      fill: textColor,
      stroke: titleStroke,
      strokeWidth: titleStrokeW,
      paintFirst: "stroke",
      textAlign: "center",
      lineHeight: 1.1,
      opacity: 1,
    });

    // ── 8. Decorative subtitle / concept line
    if (concept.mood) {
      objects.push({
        type: "i-text", version: "6.0.0",
        originX: "center", originY: "center",
        left: W / 2, top: Math.floor(H * 0.62),
        text: concept.mood.toUpperCase(),
        fontSize: 16,
        fontFamily: "Arial, sans-serif",
        fontWeight: "bold",
        fill: accent1,
        stroke: null, strokeWidth: 0,
        textAlign: "center",
        opacity: 0.85,
        charSpacing: 300,
      });
    }

  } else {
    // ── Pants layout (left + right leg panels)
    // Left leg
    objects.push({
      type: "rect", version: "6.0.0",
      originX: "left", originY: "top",
      left: 0, top: 0, width: Math.floor(W / 2) - 2, height: H,
      fill: primary, stroke: null, strokeWidth: 0, opacity: 0.88,
    });
    // Right leg
    objects.push({
      type: "rect", version: "6.0.0",
      originX: "left", originY: "top",
      left: Math.floor(W / 2) + 2, top: 0,
      width: Math.floor(W / 2) - 2, height: H,
      fill: primary, stroke: null, strokeWidth: 0, opacity: 0.72,
    });
    // Seam line
    objects.push({
      type: "rect", version: "6.0.0",
      originX: "center", originY: "top",
      left: W / 2, top: 0, width: 4, height: H,
      fill: accent1, stroke: null, strokeWidth: 0, opacity: 0.9,
    });
    // Bottom stripe left
    objects.push({
      type: "rect", version: "6.0.0",
      originX: "left", originY: "top",
      left: 0, top: H - 44, width: Math.floor(W / 2) - 2, height: 44,
      fill: accent2, stroke: null, strokeWidth: 0, opacity: 1,
    });
    // Bottom stripe right
    objects.push({
      type: "rect", version: "6.0.0",
      originX: "left", originY: "top",
      left: Math.floor(W / 2) + 2, top: H - 44,
      width: Math.floor(W / 2) - 2, height: 44,
      fill: accent2, stroke: null, strokeWidth: 0, opacity: 1,
    });
    // Main text on left leg
    objects.push({
      type: "i-text", version: "6.0.0",
      originX: "center", originY: "center",
      left: W / 4, top: H / 2 - 20,
      text: displayText,
      fontSize: Math.min(titleFontSize, 50),
      fontFamily: "Impact, Arial Black, sans-serif",
      fontWeight: "900",
      fill: textColor,
      stroke: titleStroke,
      strokeWidth: titleStrokeW,
      paintFirst: "stroke",
      textAlign: "center",
      lineHeight: 1.1,
      opacity: 1,
    });
  }

  return {
    version: "6.0.0",
    objects,
    background: bg,
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

  let concept: AiConcept = {};

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a professional Roblox clothing designer creating textures for Roblox avatars. The classic clothing template is 585×559 pixels — this exact size is required for avatar wearability. ${langInstruction} Respond with valid JSON only, no markdown.`,
        },
        {
          role: "user",
          content: `Create a Roblox ${mapped.label} design based on this request: "${prompt}"${styleDesc ? `\nStyle: ${styleDesc}` : ""}

Important: If the user mentions specific text that should appear on the garment (e.g. "with the text Roblox King"), extract that exact text into "displayText". The displayText will be printed prominently on the clothing texture.

Return JSON:
{
  "title": "Short catchy design name (max 35 chars)",
  "displayText": "The exact text to print on the garment (e.g. 'ROBLOX KING'). If no specific text mentioned, use a short version of the title.",
  "textStyle": "One of: graffiti, bold, elegant, minimal, script",
  "concept": "One vivid sentence describing the look",
  "description": "2-3 paragraph description of how it looks on a Roblox avatar",
  "mood": "Single vibe word (e.g. Edgy, Mystical, Playful, Street, Royal)",
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
  "keyElements": ["element 1", "element 2", "element 3"],
  "designTips": ["Roblox tip 1", "tip 2"],
  "suggestedTags": ["tag1", "tag2", "tag3", "tag4"]
}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    concept = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch (err) {
    req.log.error({ err }, "AI quick-create concept error");
    concept = {
      title: prompt.split(" ").slice(0, 4).join(" "),
      displayText: prompt.split(" ").slice(0, 3).join(" ").toUpperCase(),
      textStyle: "graffiti",
      concept: prompt,
      description: prompt,
      mood: "Bold",
      colors: [
        { hex: "#1a1a2e", name: "Dark Navy",    role: "primary" },
        { hex: "#e94560", name: "Neon Red",     role: "accent" },
        { hex: "#0f3460", name: "Deep Blue",    role: "shadow" },
        { hex: "#16213e", name: "Midnight",     role: "highlight" },
        { hex: "#ffffff", name: "White",        role: "base" },
      ],
      backgroundColor: "#1a1a2e",
      primaryColor: "#0f3460",
      suggestedTags: [],
    };
  }

  const title = (concept.title ?? `${prompt.slice(0, 30)} ${mapped.label}`).slice(0, 100);
  const tags  = concept.suggestedTags ?? [];

  // Build proper Fabric.js canvas at correct Roblox template size (585×559)
  const fabricCanvas = buildCanvas(concept, prompt, mapped.robloxType);

  const canvasJson = JSON.stringify({
    ...fabricCanvas,
    __aiConcept: concept,
    __itemLabel: mapped.label,
    __originalPrompt: prompt,
  });

  const [project] = await db.insert(projectsTable).values({
    id: randomUUID(),
    userId: req.user.id,
    title,
    type: mapped.robloxType,
    isAiGenerated: true,
    tags,
    canvasData: canvasJson,
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
