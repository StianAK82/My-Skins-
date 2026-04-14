import { randomUUID } from "crypto";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { aiGenerationsTable, db } from "@workspace/db";
import {
  aiDesignResponseSchema,
  aiDesignSchema,
  aiIdeaSchema,
  stylizedOutfitConceptSchema,
  stylizedOutfitResponseSchema,
  type aiGenerateRequestSchema,
} from "../../lib/ai-contracts";
import { routeAiIntent } from "../../lib/ai-intent-router";
import { aiValidationService } from "./ai-validation.service";

type GenerateInput = z.infer<typeof aiGenerateRequestSchema>;
type StylizedInput = { prompt: string; avatarType?: string; bodyType?: string; style?: string };

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

function toPreviewSlot(name: string): "face" | "hair" | "hat" | "neck" | "leftShoulder" | "rightShoulder" | "back" | "leftFootwear" | "rightFootwear" | "aura" {
  const text = name.toLowerCase();
  if (text.includes("hair")) return "hair";
  if (text.includes("face") || text.includes("eye")) return "face";
  if (text.includes("wing") || text.includes("back")) return "back";
  if (text.includes("horn") || text.includes("hat") || text.includes("halo")) return "hat";
  if (text.includes("boot") || text.includes("shoe")) return "leftFootwear";
  if (text.includes("aura") || text.includes("glow") || text.includes("flame")) return "aura";
  if (text.includes("shoulder")) return "leftShoulder";
  return "neck";
}

function roleForTerm(name: string): "hero" | "support" | "decorative" {
  const text = name.toLowerCase();
  if (text.includes("wing") || text.includes("horn") || text.includes("halo") || text.includes("dragon") || text.includes("demon")) return "hero";
  if (text.includes("aura") || text.includes("spark") || text.includes("glow") || text.includes("flame")) return "decorative";
  return "support";
}

export class AiGenerationService {
  private buildPrompt(input: GenerateInput, mode: string): string {
    const placementRule = input.itemType === "classic_shirt"
      ? "For classic_shirt: leftSleeve/rightSleeve must be descriptive strings and leftLeg/rightLeg must be exactly \"not_used\"."
      : "For classic_pants: leftLeg/rightLeg must be descriptive strings and leftSleeve/rightSleeve must be exactly \"not_used\".";
    return [
      "Return only valid JSON. No markdown. No comments. Do not wrap in backticks.",
      `mode=${mode}`,
      `itemType=${input.itemType}`,
      `prompt=${input.prompt}`,
      `style=${input.style ?? "generated-style"}`,
      `theme=${input.theme ?? "generated-theme"}`,
      "target=roblox",
      "",
      "Schema requirements (all fields required):",
      "{",
      '  "title": "string",',
      '  "itemType": "classic_shirt|classic_pants",',
      '  "style": "string",',
      '  "target": "roblox",',
      '  "theme": "string",',
      '  "colorPalette": ["#RRGGBB", "#RRGGBB"],',
      '  "designElements": ["string"],',
      '  "placement": {',
      '    "front": "string",',
      '    "back": "string",',
      '    "leftSleeve": "string",',
      '    "rightSleeve": "string",',
      '    "leftLeg": "string",',
      '    "rightLeg": "string"',
      "  },",
      '  "modules": [',
      "    {",
      '      "id": "module-id",',
      '      "type": "graphic|trim|pattern|sleeve_detail|chest_symbol|stripe",',
      '      "label": "string",',
      '      "color": "#RRGGBB",',
      '      "position": { "x": 0.5, "y": 0.5 },',
      '      "scale": 1,',
      '      "rotation": 0,',
      '      "opacity": 1,',
      '      "layer": 0',
      "    }",
      "  ],",
      '  "editorInstructions": {',
      '    "baseTemplate": "string",',
      '    "recommendedPreset": "string",',
      '    "notes": ["string"]',
      "  }",
      "}",
      "",
      "Placement rule (strict):",
      placementRule,
      "Every module must include a valid `type` enum value and a six-char hex color.",
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
    const intent = routeAiIntent(input.prompt, input.style, input.theme);

    const fallbackPalette = ["#1F2937", "#2563EB", "#F9FAFB"];
    const palette = Array.isArray(source.colorPalette)
      ? source.colorPalette.map(normalizeHex).filter((value): value is string => Boolean(value)).slice(0, 8)
      : [];
    const colorPalette = (palette.length >= 2 ? palette : fallbackPalette).slice(0, 8);

    const modulesRaw = Array.isArray(source.modules) ? source.modules : [];
    const modules = modulesRaw.slice(0, 50).map((module, index) => {
      const row = (module && typeof module === "object") ? module as Record<string, unknown> : {};
      const moduleColor = normalizeHex(row.color) ?? colorPalette[index % colorPalette.length] ?? "#2563EB";
      const position = (row.position && typeof row.position === "object") ? row.position as Record<string, unknown> : {};
      return {
        id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : `module-${index + 1}`,
        type: mapModuleType(row.type),
        label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : `Module ${index + 1}`,
        color: moduleColor,
        position: {
          x: typeof position.x === "number" ? Math.min(1, Math.max(0, position.x)) : 0.5,
          y: typeof position.y === "number" ? Math.min(1, Math.max(0, position.y)) : 0.5,
        },
        scale: typeof row.scale === "number" ? Math.min(4, Math.max(0.1, row.scale)) : 1,
        rotation: typeof row.rotation === "number" ? Math.min(360, Math.max(-360, row.rotation)) : 0,
        opacity: typeof row.opacity === "number" ? Math.min(1, Math.max(0, row.opacity)) : 0.95,
        layer: typeof row.layer === "number" ? Math.max(0, Math.round(row.layer)) : index,
      };
    });

    const placementSource = (source.placement && typeof source.placement === "object") ? source.placement as Record<string, unknown> : {};
    const placement = {
      front: typeof placementSource.front === "string" && placementSource.front.trim() ? placementSource.front : "front focal graphic",
      back: typeof placementSource.back === "string" && placementSource.back.trim() ? placementSource.back : "back supporting graphic",
      leftSleeve: itemType === "classic_shirt"
        ? (typeof placementSource.leftSleeve === "string" && placementSource.leftSleeve.trim() ? placementSource.leftSleeve : "accent stripe")
        : "not_used",
      rightSleeve: itemType === "classic_shirt"
        ? (typeof placementSource.rightSleeve === "string" && placementSource.rightSleeve.trim() ? placementSource.rightSleeve : "accent stripe")
        : "not_used",
      leftLeg: itemType === "classic_pants"
        ? (typeof placementSource.leftLeg === "string" && placementSource.leftLeg.trim() ? placementSource.leftLeg : "leg accent panel")
        : "not_used",
      rightLeg: itemType === "classic_pants"
        ? (typeof placementSource.rightLeg === "string" && placementSource.rightLeg.trim() ? placementSource.rightLeg : "leg accent panel")
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

    const accessoryTerms = ["wings", "horns", "halo", "boots", "hat", "hair", "aura", "glowing eyes"];
    const accessoryItems = accessoryTerms
      .filter((term) => input.prompt.toLowerCase().includes(term.replace(/s$/, "")) || input.prompt.toLowerCase().includes(term))
      .map((term) => ({
        name: term,
        slot: toPreviewSlot(term),
        detail: `Preview cosmetic inspired by ${term}`,
        role: roleForTerm(term),
        exportStatus: "preview_only" as const,
      }))
      .slice(0, 8);

    const avatarSlotPlan = accessoryItems.map((item, idx) => ({
      slot: item.slot,
      assetHint: `${item.name.replace(/\s+/g, "_")}_${idx + 1}`,
      role: item.role,
      rationale: `Mapped from prompt accessory term "${item.name}"`,
      color: colorPalette[idx % colorPalette.length],
    }));

    if (intent.includesAvatarLook && !avatarSlotPlan.some((slot) => slot.slot === "face")) {
      avatarSlotPlan.push({ slot: "face", assetHint: intent.fantasyArchetype ? `face_${intent.fantasyArchetype}_eyes` : "face_stylized", role: "support", rationale: "Face clarity for avatar identity", color: colorPalette[0] });
    }
    if (intent.includesAvatarLook && !avatarSlotPlan.some((slot) => slot.slot === "hair")) {
      avatarSlotPlan.push({ slot: "hair", assetHint: intent.styleVibes.includes("anime") ? "hair_anime_layered" : "hair_wavy_midnight", role: "support", rationale: "Hair establishes style silhouette", color: colorPalette[1] });
    }
    if (intent.includesEffects && !avatarSlotPlan.some((slot) => slot.slot === "aura")) {
      avatarSlotPlan.push({ slot: "aura", assetHint: "aura_energy_ring", role: "decorative", rationale: "Requested VFX or glow effects", color: colorPalette[0] });
    }

    return {
      title: typeof source.title === "string" && source.title.trim() ? source.title.trim() : "Generated Roblox Design",
      itemType,
      style: typeof source.style === "string" && source.style.trim() ? source.style.trim() : (input.style ?? "Generated"),
      target: "roblox",
      theme: typeof source.theme === "string" && source.theme.trim() ? source.theme.trim() : (input.theme ?? input.prompt.slice(0, 80)),
      colorPalette,
      designElements: designElements.length > 0 ? designElements : ["core motif"],
      intent,
      clothingPlan: {
        summary: `Classic ${itemType === "classic_shirt" ? "shirt" : "pants"} plan for ${input.prompt}`,
        layers: designElements.length > 0 ? designElements.slice(0, 8) : ["base fill", "main motif", "accent trim"],
        paletteLogic: `Use ${colorPalette[0]} as base, ${colorPalette[1]} for hero contrast, and keep trim readable at Roblox distance.`,
      },
      avatarLookPlan: {
        identity: intent.fantasyArchetype ? `${intent.fantasyArchetype} inspired avatar` : "cohesive stylized avatar",
        silhouette: intent.includesAccessories ? "strong accessory silhouette" : "clean readable silhouette",
        hair: intent.styleVibes.includes("anime") ? "high-volume anime hair" : "structured modern hair",
        face: intent.includesEffects ? "high-contrast glowing eyes" : "clean expression",
        aura: intent.includesEffects ? "energy aura" : null,
      },
      accessoryPlan: {
        items: accessoryItems,
      },
      previewOnlyPlan: {
        cosmetics: avatarSlotPlan.map((slot) => ({
          category: slot.slot === "aura" ? "effect" : "accessory",
          label: slot.assetHint,
          slot: slot.slot,
          role: slot.role,
        })),
      },
      exportablePlan: {
        classicShirt: itemType === "classic_shirt",
        classicPants: itemType === "classic_pants",
        notes: [
          "Classic shirt/pants layers are exportable now.",
          "Avatar cosmetics and creature accessories are preview-only in this release.",
        ],
      },
      avatarSlotPlan: avatarSlotPlan.slice(0, 12),
      placement,
      modules,
      editorInstructions: {
        baseTemplate: typeof editorSource.baseTemplate === "string" && editorSource.baseTemplate.trim()
          ? editorSource.baseTemplate
          : `${itemType}_default`,
        recommendedPreset: typeof editorSource.recommendedPreset === "string" && editorSource.recommendedPreset.trim()
          ? editorSource.recommendedPreset
          : (input.style ?? "custom"),
        notes: notes.length > 0 ? notes : ["Keep contrast high for Roblox readability."],
      },
    };
  }

  private async askModel(prompt: string): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 1400,
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
