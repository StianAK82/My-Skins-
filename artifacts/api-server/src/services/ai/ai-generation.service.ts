import { randomUUID } from "crypto";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { aiGenerationsTable, db } from "@workspace/db";
import { aiDesignResponseSchema, aiIdeaSchema, type aiGenerateRequestSchema } from "../../lib/ai-contracts";
import { aiValidationService } from "./ai-validation.service";

type GenerateInput = z.infer<typeof aiGenerateRequestSchema>;

function parseStrictJson(content: string): unknown {
  return JSON.parse(content);
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

export class AiGenerationService {
  private buildPrompt(input: GenerateInput, mode: string): string {
    return [
      "Return only valid JSON. No markdown. No comments.",
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
      "Placement rule:",
      "- classic_shirt => leftSleeve/rightSleeve must be descriptive strings, leftLeg/rightLeg must be not_used.",
      "- classic_pants => leftLeg/rightLeg must be descriptive strings, leftSleeve/rightSleeve must be not_used.",
    ].filter(Boolean).join("\n");
  }

  private normalizeDesignPayload(input: GenerateInput, payload: unknown): unknown {
    const raw = (payload && typeof payload === "object") ? payload as Record<string, unknown> : {};
    const source = (raw.result && typeof raw.result === "object") ? raw.result as Record<string, unknown> : raw;
    const itemType = input.itemType;

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

    return {
      title: typeof source.title === "string" && source.title.trim() ? source.title.trim() : "Generated Roblox Design",
      itemType,
      style: typeof source.style === "string" && source.style.trim() ? source.style.trim() : (input.style ?? "Generated"),
      target: "roblox",
      theme: typeof source.theme === "string" && source.theme.trim() ? source.theme.trim() : (input.theme ?? input.prompt.slice(0, 80)),
      colorPalette,
      designElements: designElements.length > 0 ? designElements : ["core motif"],
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
      throw new SyntaxError("AI returned empty content");
    }
    console.info("ai.model.raw_response", { content });
    return parseStrictJson(content);
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
    const design = aiValidationService.ensureDesign(modelResult);
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
}

export const aiGenerationService = new AiGenerationService();
