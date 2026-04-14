import { randomUUID } from "crypto";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { aiGenerationsTable, db } from "@workspace/db";
import {
  aiDesignResponseSchema,
  aiDesignSchema,
  aiIdeaSchema,
  styleIdentitySchema,
  stylizedOutfitConceptSchema,
  stylizedOutfitResponseSchema,
  type aiGenerateRequestSchema,
} from "../../lib/ai-contracts";
import { aiValidationService } from "./ai-validation.service";

type GenerateInput = z.infer<typeof aiGenerateRequestSchema>;
type StylizedInput = { prompt: string; avatarType?: string; bodyType?: string; style?: string };

type StyleIdentity = z.infer<typeof styleIdentitySchema>;

function parseStrictJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fenced) return JSON.parse(fenced);

    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(content.slice(firstBrace, lastBrace + 1));
    }
    throw new SyntaxError("AI returned non-JSON content");
  }
}

function normalizeHex(color: unknown): string | null {
  if (typeof color !== "string") return null;
  const trimmed = color.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null;
  return withHash.toUpperCase();
}

function mapModuleType(value: unknown): string {
  if (typeof value !== "string") return "graphic";
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    graphic: "graphic",
    trim: "trim",
    trim_line: "trim",
    pattern: "pattern",
    sleeve_detail: "sleeve_detail",
    sleeve: "sleeve_detail",
    chest_symbol: "chest_symbol",
    logo: "chest_symbol",
    stripe: "stripe",
    stripes: "stripe",
  };
  return map[normalized] ?? "graphic";
}

function inferStyleIdentity(style: string, prompt: string): StyleIdentity {
  const source = `${style} ${prompt}`.toLowerCase();
  if (source.includes("dark") && source.includes("flame")) return "dark_flame";
  if (source.includes("anime") || source.includes("kawaii")) return source.includes("pastel") ? "cute_pastel" : "anime_cute";
  if (source.includes("cyber") || source.includes("techwear")) return "cyber_streetwear";
  if (source.includes("tactical") || source.includes("military")) return "tactical";
  if (source.includes("lux") || source.includes("royal")) return "luxury";
  if (source.includes("sport") || source.includes("athletic")) return "sporty";
  if (source.includes("fantasy") || source.includes("magic")) return "fantasy";
  if (source.includes("goth")) return "gothic";
  if (source.includes("villain")) return "villain";
  if (source.includes("hero")) return "heroic";
  if (source.includes("minimal") || source.includes("clean")) return "minimal";
  return "cyber_streetwear";
}

function buildPlacementDefaults(itemType: GenerateInput["itemType"]) {
  if (itemType === "classic_shirt") {
    return {
      front: "hero graphic center chest",
      back: "secondary insignia upper back",
      leftSleeve: "trim stripe with accent edge",
      rightSleeve: "trim stripe with accent edge",
      leftLeg: "not_used",
      rightLeg: "not_used",
    };
  }

  return {
    front: "dual panel leg concept front",
    back: "rear seam continuation",
    leftSleeve: "not_used",
    rightSleeve: "not_used",
    leftLeg: "left leg dominant motif",
    rightLeg: "right leg supporting motif",
  };
}

export class AiGenerationService {
  private buildPrompt(input: GenerateInput, mode: string): string {
    const placementRule = input.itemType === "classic_shirt"
      ? "For classic_shirt: leftSleeve/rightSleeve must be descriptive and leftLeg/rightLeg must be exactly \"not_used\"."
      : "For classic_pants: leftLeg/rightLeg must be descriptive and leftSleeve/rightSleeve must be exactly \"not_used\".";

    const identityGuide = "Pick one styleIdentity enum from: dark_flame, anime_cute, cyber_streetwear, tactical, luxury, sporty, fantasy, gothic, cute_pastel, heroic, villain, minimal.";
    return [
      "Return only valid JSON. No markdown. No comments. Do not wrap in backticks.",
      "You are a senior Roblox outfit director for My Skins.",
      "Output must feel stylish, distinct, intentional, and editable in a layered clothing editor.",
      "Avoid generic filler labels like 'module 1' or 'nice design'.",
      `mode=${mode}`,
      `itemType=${input.itemType}`,
      `prompt=${input.prompt}`,
      `style=${input.style ?? "generated-style"}`,
      `theme=${input.theme ?? "generated-theme"}`,
      "target=roblox",
      identityGuide,
      "Palette rule: always include at least 3 colors and provide a high-contrast readable pair.",
      "Composition rule: include at least one hero focal element and layered support details.",
      "Avatar rule: coordinate face/hair/accessories/aura with the clothing style.",
      "Variation rule: no repetitive outputs; if prompt is subtle use cleaner trims, if bold use stronger symbol + accents.",
      "",
      "Schema requirements (all fields required):",
      "{",
      '  "title": "string",',
      '  "itemType": "classic_shirt|classic_pants",',
      '  "style": "string",',
      '  "styleIdentity": "dark_flame|anime_cute|cyber_streetwear|tactical|luxury|sporty|fantasy|gothic|cute_pastel|heroic|villain|minimal",',
      '  "target": "roblox",',
      '  "theme": "string",',
      '  "colorPalette": ["#RRGGBB", "#RRGGBB", "#RRGGBB"],',
      '  "paletteRoles": {',
      '    "primary": "#RRGGBB", "secondary": "#RRGGBB", "accent": "#RRGGBB", "neutral": "#RRGGBB",',
      '    "contrastPair": ["#RRGGBB", "#RRGGBB"], "contrastLevel": "high|medium"',
      "  },",
      '  "designElements": ["string", "string", "string"],',
      '  "placement": { "front": "string", "back": "string", "leftSleeve": "string", "rightSleeve": "string", "leftLeg": "string", "rightLeg": "string" },',
      '  "modules": [',
      '    { "id": "module-id", "type": "graphic|trim|pattern|sleeve_detail|chest_symbol|stripe", "label": "string", "color": "#RRGGBB", "position": { "x": 0.5, "y": 0.5 }, "scale": 1, "rotation": 0, "opacity": 1, "layer": 0 }',
      "  ],",
      '  "outfitComposition": {',
      '    "silhouette": "slim|balanced|oversized|armored", "vibe": "subtle|bold|flashy|minimal",',
      '    "garmentFocus": "front_graphic|allover_pattern|trim_work|symbolic|split_panel",',
      '    "trimIntent": "string", "patternDensity": "none|light|medium|heavy", "accessoryDensity": "none|light|medium|heavy"',
      "  },",
      '  "avatarCoordination": {',
      '    "faceMood": "friendly|confident|stoic|mischievous|fierce", "hairMood": "clean|spiky|flowy|cute|edgy",',
      '    "auraIntent": "none|subtle|energy|flame|shadow|sparkle",',
      '    "accessoryIntent": ["hat"|"neck"|"shoulders"|"back"|"footwear"],',
      '    "cohesionNotes": ["string", "string"]',
      "  },",
      '  "qualitySignals": {',
      '    "distinctiveness": 1-10, "paletteScore": 1-10, "coherenceScore": 1-10, "robloxReadability": 1-10',
      "  },",
      '  "editorInstructions": { "baseTemplate": "string", "recommendedPreset": "string", "notes": ["string"] }',
      "}",
      "",
      "Placement rule (strict):",
      placementRule,
      "Every module must include a valid enum type and six-char hex color.",
      "Do not leave modules empty. Produce 4-8 coordinated modules with non-identical positioning.",
    ].filter(Boolean).join("\n");
  }

  private logRawSchemaDiff(rawPayload: unknown, request: GenerateInput) {
    const source = (rawPayload && typeof rawPayload === "object" && "result" in rawPayload)
      ? (rawPayload as { result?: unknown }).result
      : rawPayload;
    const parsed = aiDesignSchema.safeParse(source);
    if (parsed.success) {
      console.info("ai.model.raw_schema_valid", { itemType: request.itemType });
      return;
    }

    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));
    console.warn("ai.model.raw_schema_invalid", {
      itemType: request.itemType,
      details,
      rawSource: source,
    });
  }

  private normalizeDesignPayload(input: GenerateInput, payload: unknown): unknown {
    const raw = (payload && typeof payload === "object") ? payload as Record<string, unknown> : {};
    const source = (raw.result && typeof raw.result === "object") ? raw.result as Record<string, unknown> : raw;
    const itemType = input.itemType;

    const fallbackPalette = ["#111827", "#22D3EE", "#F8FAFC", "#FB7185"];
    const palette = Array.isArray(source.colorPalette)
      ? source.colorPalette.map(normalizeHex).filter((value): value is string => Boolean(value)).slice(0, 8)
      : [];
    const colorPalette = (palette.length >= 3 ? palette : fallbackPalette).slice(0, 8);

    const style = typeof source.style === "string" && source.style.trim() ? source.style.trim() : (input.style ?? "Generated");
    const styleIdentity = styleIdentitySchema.catch(inferStyleIdentity(style, input.prompt)).parse(source.styleIdentity);

    const modulesRaw = Array.isArray(source.modules) ? source.modules : [];
    const modules = modulesRaw.slice(0, 50).map((module, index) => {
      const row = (module && typeof module === "object") ? module as Record<string, unknown> : {};
      const moduleColor = normalizeHex(row.color) ?? colorPalette[index % colorPalette.length] ?? "#22D3EE";
      const position = (row.position && typeof row.position === "object") ? row.position as Record<string, unknown> : {};
      return {
        id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : `module-${index + 1}`,
        type: mapModuleType(row.type),
        label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : `Accent ${index + 1}`,
        color: moduleColor,
        position: {
          x: typeof position.x === "number" ? Math.min(1, Math.max(0, position.x)) : 0.5,
          y: typeof position.y === "number" ? Math.min(1, Math.max(0, position.y)) : 0.5,
        },
        scale: typeof row.scale === "number" ? Math.min(4, Math.max(0.1, row.scale)) : (index === 0 ? 1.08 : 0.72),
        rotation: typeof row.rotation === "number" ? Math.min(360, Math.max(-360, row.rotation)) : 0,
        opacity: typeof row.opacity === "number" ? Math.min(1, Math.max(0, row.opacity)) : 0.95,
        layer: typeof row.layer === "number" ? Math.max(0, Math.round(row.layer)) : index,
      };
    });

    const enforcedModules = modules.length >= 4
      ? modules
      : [
        ...modules,
        {
          id: "hero-symbol",
          type: "chest_symbol",
          label: "Hero Symbol",
          color: colorPalette[2] ?? colorPalette[0],
          position: { x: 0.5, y: 0.35 },
          scale: 0.92,
          rotation: 0,
          opacity: 1,
          layer: modules.length,
        },
        {
          id: "trim-track",
          type: "trim",
          label: "Trim Track",
          color: colorPalette[1],
          position: { x: 0.5, y: 0.58 },
          scale: 0.86,
          rotation: 0,
          opacity: 0.95,
          layer: modules.length + 1,
        },
        {
          id: "support-stripe",
          type: "stripe",
          label: "Support Stripe",
          color: colorPalette[3] ?? colorPalette[0],
          position: { x: 0.2, y: 0.5 },
          scale: 0.6,
          rotation: -5,
          opacity: 0.9,
          layer: modules.length + 2,
        },
      ].slice(0, 8);

    const placementSource = (source.placement && typeof source.placement === "object") ? source.placement as Record<string, unknown> : {};
    const placementDefaults = buildPlacementDefaults(itemType);
    const placement = {
      front: typeof placementSource.front === "string" && placementSource.front.trim() ? placementSource.front : placementDefaults.front,
      back: typeof placementSource.back === "string" && placementSource.back.trim() ? placementSource.back : placementDefaults.back,
      leftSleeve: itemType === "classic_shirt"
        ? (typeof placementSource.leftSleeve === "string" && placementSource.leftSleeve.trim() ? placementSource.leftSleeve : placementDefaults.leftSleeve)
        : "not_used",
      rightSleeve: itemType === "classic_shirt"
        ? (typeof placementSource.rightSleeve === "string" && placementSource.rightSleeve.trim() ? placementSource.rightSleeve : placementDefaults.rightSleeve)
        : "not_used",
      leftLeg: itemType === "classic_pants"
        ? (typeof placementSource.leftLeg === "string" && placementSource.leftLeg.trim() ? placementSource.leftLeg : placementDefaults.leftLeg)
        : "not_used",
      rightLeg: itemType === "classic_pants"
        ? (typeof placementSource.rightLeg === "string" && placementSource.rightLeg.trim() ? placementSource.rightLeg : placementDefaults.rightLeg)
        : "not_used",
    };

    const editorSource = (source.editorInstructions && typeof source.editorInstructions === "object")
      ? source.editorInstructions as Record<string, unknown>
      : {};
    const notes = Array.isArray(editorSource.notes)
      ? editorSource.notes.filter((note): note is string => typeof note === "string" && Boolean(note.trim())).slice(0, 8)
      : [];

    const designElements = Array.isArray(source.designElements)
      ? source.designElements.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())).slice(0, 12)
      : [];

    const paletteRolesSource = (source.paletteRoles && typeof source.paletteRoles === "object") ? source.paletteRoles as Record<string, unknown> : {};
    const paletteRoles = {
      primary: normalizeHex(paletteRolesSource.primary) ?? colorPalette[0],
      secondary: normalizeHex(paletteRolesSource.secondary) ?? colorPalette[1],
      accent: normalizeHex(paletteRolesSource.accent) ?? colorPalette[2],
      neutral: normalizeHex(paletteRolesSource.neutral) ?? "#111827",
      contrastPair: [
        normalizeHex(Array.isArray(paletteRolesSource.contrastPair) ? paletteRolesSource.contrastPair[0] : null) ?? colorPalette[0],
        normalizeHex(Array.isArray(paletteRolesSource.contrastPair) ? paletteRolesSource.contrastPair[1] : null) ?? "#F8FAFC",
      ] as [string, string],
      contrastLevel: paletteRolesSource.contrastLevel === "high" ? "high" as const : "medium" as const,
    };

    const compositionSource = (source.outfitComposition && typeof source.outfitComposition === "object")
      ? source.outfitComposition as Record<string, unknown>
      : {};

    const avatarSource = (source.avatarCoordination && typeof source.avatarCoordination === "object")
      ? source.avatarCoordination as Record<string, unknown>
      : {};

    const stylePreset = {
      dark_flame: { silhouette: "balanced", vibe: "bold", garmentFocus: "symbolic", density: "medium", aura: "flame" },
      anime_cute: { silhouette: "slim", vibe: "flashy", garmentFocus: "front_graphic", density: "light", aura: "sparkle" },
      cyber_streetwear: { silhouette: "oversized", vibe: "bold", garmentFocus: "trim_work", density: "medium", aura: "energy" },
      tactical: { silhouette: "armored", vibe: "subtle", garmentFocus: "split_panel", density: "medium", aura: "none" },
      luxury: { silhouette: "balanced", vibe: "minimal", garmentFocus: "trim_work", density: "light", aura: "subtle" },
      sporty: { silhouette: "slim", vibe: "bold", garmentFocus: "trim_work", density: "light", aura: "energy" },
      fantasy: { silhouette: "oversized", vibe: "flashy", garmentFocus: "symbolic", density: "heavy", aura: "sparkle" },
      gothic: { silhouette: "balanced", vibe: "bold", garmentFocus: "allover_pattern", density: "medium", aura: "shadow" },
      cute_pastel: { silhouette: "slim", vibe: "subtle", garmentFocus: "front_graphic", density: "light", aura: "sparkle" },
      heroic: { silhouette: "armored", vibe: "bold", garmentFocus: "symbolic", density: "medium", aura: "energy" },
      villain: { silhouette: "armored", vibe: "flashy", garmentFocus: "split_panel", density: "medium", aura: "shadow" },
      minimal: { silhouette: "slim", vibe: "minimal", garmentFocus: "trim_work", density: "none", aura: "none" },
    } as const;

    const preset = stylePreset[styleIdentity];
    const density = preset.density === "none" ? "none" : preset.density;

    const qualitySource = (source.qualitySignals && typeof source.qualitySignals === "object")
      ? source.qualitySignals as Record<string, unknown>
      : {};

    return {
      title: typeof source.title === "string" && source.title.trim() ? source.title.trim() : "Generated Roblox Design",
      itemType,
      style,
      styleIdentity,
      target: "roblox",
      theme: typeof source.theme === "string" && source.theme.trim() ? source.theme.trim() : (input.theme ?? input.prompt.slice(0, 80)),
      colorPalette,
      paletteRoles,
      designElements: designElements.length >= 3 ? designElements : ["hero motif", "support trim", "contrast accent"],
      placement,
      modules: enforcedModules,
      outfitComposition: {
        silhouette: compositionSource.silhouette === "slim" || compositionSource.silhouette === "balanced" || compositionSource.silhouette === "oversized" || compositionSource.silhouette === "armored" ? compositionSource.silhouette : preset.silhouette,
        vibe: compositionSource.vibe === "subtle" || compositionSource.vibe === "bold" || compositionSource.vibe === "flashy" || compositionSource.vibe === "minimal" ? compositionSource.vibe : preset.vibe,
        garmentFocus: compositionSource.garmentFocus === "front_graphic" || compositionSource.garmentFocus === "allover_pattern" || compositionSource.garmentFocus === "trim_work" || compositionSource.garmentFocus === "symbolic" || compositionSource.garmentFocus === "split_panel" ? compositionSource.garmentFocus : preset.garmentFocus,
        trimIntent: typeof compositionSource.trimIntent === "string" && compositionSource.trimIntent.trim() ? compositionSource.trimIntent : "Use trim to connect hero and support modules across seams.",
        patternDensity: compositionSource.patternDensity === "none" || compositionSource.patternDensity === "light" || compositionSource.patternDensity === "medium" || compositionSource.patternDensity === "heavy" ? compositionSource.patternDensity : density,
        accessoryDensity: compositionSource.accessoryDensity === "none" || compositionSource.accessoryDensity === "light" || compositionSource.accessoryDensity === "medium" || compositionSource.accessoryDensity === "heavy" ? compositionSource.accessoryDensity : density,
      },
      avatarCoordination: {
        faceMood: avatarSource.faceMood === "friendly" || avatarSource.faceMood === "confident" || avatarSource.faceMood === "stoic" || avatarSource.faceMood === "mischievous" || avatarSource.faceMood === "fierce" ? avatarSource.faceMood : (styleIdentity === "villain" ? "fierce" : "confident"),
        hairMood: avatarSource.hairMood === "clean" || avatarSource.hairMood === "spiky" || avatarSource.hairMood === "flowy" || avatarSource.hairMood === "cute" || avatarSource.hairMood === "edgy" ? avatarSource.hairMood : (styleIdentity === "anime_cute" || styleIdentity === "cute_pastel" ? "cute" : "edgy"),
        auraIntent: avatarSource.auraIntent === "none" || avatarSource.auraIntent === "subtle" || avatarSource.auraIntent === "energy" || avatarSource.auraIntent === "flame" || avatarSource.auraIntent === "shadow" || avatarSource.auraIntent === "sparkle" ? avatarSource.auraIntent : preset.aura,
        accessoryIntent: Array.isArray(avatarSource.accessoryIntent)
          ? avatarSource.accessoryIntent.filter((entry): entry is string => typeof entry === "string").filter((entry) => ["hat", "neck", "shoulders", "back", "footwear"].includes(entry)).slice(0, 5)
          : [itemType === "classic_pants" ? "footwear" : "neck", "hat"],
        cohesionNotes: Array.isArray(avatarSource.cohesionNotes)
          ? avatarSource.cohesionNotes.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())).slice(0, 8)
          : [
            "Align accessory metals and trims to the accent color.",
            "Keep face expression matched to vibe and silhouette intent.",
          ],
      },
      qualitySignals: {
        distinctiveness: typeof qualitySource.distinctiveness === "number" ? Math.max(1, Math.min(10, Math.round(qualitySource.distinctiveness))) : 8,
        paletteScore: typeof qualitySource.paletteScore === "number" ? Math.max(1, Math.min(10, Math.round(qualitySource.paletteScore))) : 8,
        coherenceScore: typeof qualitySource.coherenceScore === "number" ? Math.max(1, Math.min(10, Math.round(qualitySource.coherenceScore))) : 8,
        robloxReadability: typeof qualitySource.robloxReadability === "number" ? Math.max(1, Math.min(10, Math.round(qualitySource.robloxReadability))) : 8,
      },
      editorInstructions: {
        baseTemplate: typeof editorSource.baseTemplate === "string" && editorSource.baseTemplate.trim()
          ? editorSource.baseTemplate
          : `${itemType}_default`,
        recommendedPreset: typeof editorSource.recommendedPreset === "string" && editorSource.recommendedPreset.trim()
          ? editorSource.recommendedPreset
          : (input.style ?? styleIdentity),
        notes: notes.length > 0 ? notes : ["Keep contrast high for Roblox readability.", "Preserve one hero focal point and 2-3 supporting details."],
      },
    };
  }

  private async askModel(prompt: string): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are the My Skins structured Roblox design engine. Always return JSON only." },
          { role: "user", content: prompt },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        lastError = new SyntaxError("AI returned empty content");
        continue;
      }
      console.info("ai.model.raw_response", { attempt, content });
      try {
        return parseStrictJson(content);
      } catch (error) {
        lastError = error instanceof Error ? error : new SyntaxError("AI returned non-JSON content");
        console.error("ai.model.invalid_json", { attempt, content, error: lastError });
      }
    }

    throw lastError ?? new SyntaxError("AI returned non-JSON content");
  }

  private async saveGeneration(userId: string, prompt: string, type: string, result: unknown, style: string | null = null) {
    const generationId = randomUUID();
    await db.insert(aiGenerationsTable).values({
      id: generationId,
      userId,
      prompt,
      result: JSON.stringify(result),
      type,
      style,
    });
    return generationId;
  }

  async generateDesign(userId: string, input: GenerateInput) {
    const modelResult = await this.askModel(this.buildPrompt(input, "generate"));
    this.logRawSchemaDiff(modelResult, input);
    const normalized = this.normalizeDesignPayload(input, modelResult);
    const design = aiValidationService.ensureDesign(normalized);
    const generationId = await this.saveGeneration(userId, input.prompt, "generate", design, input.style ?? null);

    return aiDesignResponseSchema.parse({
      meta: { generationId, status: "completed", warnings: [] },
      result: design,
    });
  }

  async improveDesign(userId: string, instruction: string, source: unknown, mode: "improve" | "remix") {
    const designSource = aiValidationService.ensureDesign(source);
    const modelResult = await this.askModel(`${mode} this design with instruction: ${instruction}\nsource:${JSON.stringify(designSource)}`);
    this.logRawSchemaDiff(modelResult, {
      prompt: instruction,
      itemType: designSource.itemType,
      style: designSource.style,
      theme: designSource.theme,
    });
    const design = aiValidationService.ensureDesign(this.normalizeDesignPayload(
      {
        prompt: instruction,
        itemType: designSource.itemType,
        style: designSource.style,
        theme: designSource.theme,
      },
      modelResult,
    ));
    const generationId = await this.saveGeneration(userId, instruction, mode, design, null);
    return aiDesignResponseSchema.parse({
      meta: { generationId, status: "completed", warnings: [] },
      result: design,
    });
  }

  async generateIdea(input: GenerateInput) {
    return aiIdeaSchema.parse(await this.askModel(this.buildPrompt(input, "idea")));
  }

  async generateModules(input: GenerateInput) {
    return aiValidationService.ensureModules(await this.askModel(this.buildPrompt(input, "modules")));
  }

  async generatePalette(input: GenerateInput) {
    return aiValidationService.ensurePalette(await this.askModel(this.buildPrompt(input, "palette")));
  }

  async generateLayout(input: GenerateInput) {
    return aiValidationService.ensureLayout(await this.askModel(this.buildPrompt(input, "layout")));
  }

  async generateStylizedOutfit(userId: string, input: StylizedInput) {
    const prompt = [
      "Return only strict JSON for a stylized Roblox outfit concept render plan.",
      "Do not output classic shirt template instructions.",
      `prompt=${input.prompt}`,
      `avatarType=${input.avatarType ?? "neutral"}`,
      `bodyType=${input.bodyType ?? "regular"}`,
      `styleHint=${input.style ?? "stylized"}`,
      "",
      "Schema:",
      "{",
      '  "title":"string",',
      '  "theme":"string",',
      '  "styleTone":"string",',
      '  "mood":"string",',
      '  "visualSummary":"string",',
      '  "colorPalette":["#RRGGBB","#RRGGBB","#RRGGBB"],',
      '  "materials":["string","string"],',
      '  "clothingPieces":[{"name":"string","description":"string","material":"string","color":"#RRGGBB"}],',
      '  "accessories":[{"name":"string","placement":"string","detail":"string","color":"#RRGGBB"}],',
      '  "trimsAndDetails":["string","string"]',
      "}",
    ].join("\n");

    const raw = await this.askModel(prompt);
    const concept = stylizedOutfitConceptSchema.parse(raw);
    const generationId = await this.saveGeneration(userId, input.prompt, "stylized_outfit", concept, input.style ?? null);
    return stylizedOutfitResponseSchema.parse({
      meta: { generationId, status: "completed", warnings: [] },
      result: concept,
    });
  }
}

export const aiGenerationService = new AiGenerationService();
