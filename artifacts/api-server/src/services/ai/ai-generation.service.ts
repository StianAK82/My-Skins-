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

export class AiGenerationService {
  private buildPrompt(input: GenerateInput, mode: string): string {
    return [
      `mode: ${mode}`,
      `itemType: ${input.itemType}`,
      "target: roblox",
      `prompt: ${input.prompt}`,
      input.style ? `style: ${input.style}` : "",
      input.theme ? `theme: ${input.theme}` : "",
      "Placement rule: classic_shirt uses sleeves and marks legs as not_used. classic_pants uses legs and marks sleeves as not_used.",
    ].filter(Boolean).join("\n");
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
    const design = aiValidationService.ensureDesign(modelResult);
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
