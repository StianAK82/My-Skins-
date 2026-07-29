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
import { normalizeDesignPayload } from "../../lib/ai-normalize";
import { aiValidationService } from "./ai-validation.service";

type GenerateInput = z.infer<typeof aiGenerateRequestSchema>;
type StylizedInput = { prompt: string; avatarType?: string; bodyType?: string; style?: string };

function closeTruncatedJson(input: string): string {
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  let result = input;
  if (inStr) {
    const lastQuote = result.lastIndexOf('"');
    if (lastQuote >= 0) result = result.slice(0, lastQuote);
  }
  result = result.replace(/\s*[,:]?\s*$/g, "");
  result = result.replace(/"[^"]*"\s*:\s*$/g, "");
  result = result.replace(/,\s*$/g, "");
  while (stack.length) result += stack.pop();
  return result;
}

function parseStrictJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced);
      } catch {
        /* fall through to brace slicing */
      }
    }

    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(content.slice(firstBrace, lastBrace + 1));
      } catch {
        /* fall through to truncation repair */
      }
    }

    if (firstBrace >= 0) {
      try {
        return JSON.parse(closeTruncatedJson(content.slice(firstBrace)));
      } catch {
        /* repair failed */
      }
    }
    throw new SyntaxError("AI returned non-JSON content");
  }
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
      "  },",
      '  "outfit": {',
      '    "top": "hoodie|sweater|tshirt|jacket|dress|none",',
      '    "bottom": "pants|shorts|skirt|none",',
      '    "shoes": "none|sneakers|boots",',
      '    "hair": {"style": "none|short|long|ponytail|twintails|spiky|curly|braids|wavy|snakes", "color": "#RRGGBB"},',
      '    "accessories": [{"kind": "cap|beanie|hat|helmet|crown|glasses|mask|wings|backpack|bag|necklace|scarf|horns|tail|belt|gloves|unicorn_horn|dragon_hood|jetpack|sword|shoulder_guards|shoulder_pet|aura|flame_aura|pixel_aura", "color": "#RRGGBB"}],',
      '    "customParts": [{"name": "string", "shape": "horn|spike|orb|plate|band|snake|fin|blob|headcover", "attach": "forehead|head_top|face|neck|chest|belly|back|hips|left_shoulder|right_shoulder|left_hand|right_hand|left_leg|right_leg|left_foot|right_foot", "color": "#RRGGBB", "size": "small|medium|large"}],',
      '    "unsupported": ["string"],',
      '    "reason": "string"',
      "  }",
      "}",
      "",
      "Outfit rule (strict): `outfit` lists EXACTLY the items the user asked for — every requested item, nothing extra, no substitutions.",
      "LANGUAGE (strict): the prompt is written by a child in ANY language (Norwegian, English, Swedish, Spanish, Arabic, Ukrainian, ...) often with heavy typos — always interpret the intent regardless of language (e.g. 't-sjhortet' means t-skjorte, 'capps' means caps, 'marshmelo hed' means marshmallow head). Never refuse or misread a wish because of its language.",
      "Write every child-facing string (`customParts[].name`, `unsupported` entries, `reason`) in the SAME language the child wrote in.",
      "Norwegian glossary (help for the most common language): hettegenser=hoodie, genser/collegegenser=sweater, t-skjorte/skjorte=tshirt, jakke/vinterjakke=jacket, kjole=dress, skjørt=skirt, bukse/olabukse/jeans/joggebukse/cargobukse=pants, shorts=shorts, sko/joggesko=sneakers, støvler=boots, caps=cap, lue=beanie, hatt=hat, hjelm=helmet, krone=crown, briller=glasses, maske=mask, vinger=wings, ryggsekk/sekk=backpack, veske/bag=bag, kjede/halskjede=necklace, skjerf=scarf, hansker=gloves, belte=belt, hale=tail, hår=hair, bølgete hår=wavy hair, jetpack/rakettsekk=jetpack, sverd (på ryggen)=sword, skulderplater/rustning på skuldrene=shoulder_guards, liten venn/kjæledyr på skulderen=shoulder_pet, glorie/lysring/aura=aura, ildring/flammering=flame_aura, pikselgnister=pixel_aura.",
      "Full-outfit words mean top AND bottom: treningsdress/tracksuit=jacket+pants+sneakers, dress/suit=jacket+pants, fotballdrakt/football kit=tshirt+shorts+sneakers, ninja/kostyme/antrekk/outfit=top+bottom. The word 'skin' alone means a complete look (top+bottom).",
      "hair.style is \"none\" unless the user asks for hair. accessories only contains requested items (max 6).",
      "Everything in the outfit schema (shoes, hair, all listed accessory kinds) IS supported in the 3D preview — never list those in `unsupported`. Only put something in `unsupported` when it truly cannot be represented (e.g. a specific brand logo, an animal companion).",
      "If the user only asks for one piece (e.g. only a t-shirt), set every other field to none/empty.",
      "",
      "customParts — NO LIMITS placement rule (strict): children can ask for ANYTHING anywhere on the body, and you MUST build it exactly where they say using `customParts` (max 4). Pick the closest shape + the exact attach point the child names.",
      "Examples: «horn i panna» → {name:'Horn i panna', shape:'horn', attach:'forehead'}; «horn i magen» → {shape:'horn', attach:'belly'}; «pigger på ryggen» → {shape:'spike', attach:'back'}; «magisk kule i hånda» → {shape:'orb', attach:'right_hand'}; «finner på beina» → {shape:'fin', attach:'left_leg'} + {attach:'right_leg'}.",
      "«slanger som hår» / «medusa» → hair.style='snakes' with green color (do NOT use customParts for snake hair).",
      "Fantasy HEADS (marshmallow head, pumpkin head, cheese head, robot head ...) → shape:'headcover' attach:'face' with the iconic color (marshmallow=#FFF7EE, pumpkin=#E8862E): it wraps the whole head. Example: «marshmallow head» → {name:'Marshmallow head', shape:'headcover', attach:'face', color:'#FFF7EE', size:'large'}.",
      "Never refuse a placement, never move it somewhere more 'normal', never put it in `unsupported` — the child's exact wish wins. Use customParts for anything the accessory kinds don't cover.",
      "",
      "Themed looks (strict — use the ICONIC real-world costume, correct colors are mandatory):",
      "When the prompt names a creature or figure (enhjørning, prinsesse, drage, ninja, superhelt, pirat, astronaut ...), the child wants to BE that figure. This OVERRIDES the single-piece rule: fill the FULL outfit — top AND bottom AND the theme's mandatory accessories below — never just a motif on a shirt, and never leave outfit fields at none for a themed request.",
      "- enhjørning/unicorn: WHITE base with pastel rainbow accents (pink #F8A8C8, purple #B78BE8, turquoise #7DD8D8, gold). top=hoodie or dress in white/pastel, accessories MUST include {kind:'unicorn_horn', color:'#F5C542'} (a unicorn head-hat: white ears + gold spiral horn + rainbow mane) and {kind:'tail', color:'#F8A8C8'}. Motif: rainbow/stars. NEVER dark or navy colors.",
      "- prinsesse/princess (eventyrprinsesse): a fairytale BALL GOWN — top=dress in pink #F7B6D2 or light blue #A8C8F0 with GOLD trim, fitted bodice + big voluminous skirt look, puffed sleeves. hair=long unless the user says otherwise, accessories MUST include {kind:'crown', color:'#F5C542'} (tiara) and may include {kind:'necklace'} and {kind:'gloves', color:'#FFFFFF'}. Elegant sparkle motif, NEVER dark/street colors.",
      "- drage/dragon: GREEN #3E8E4E or RED #C0392B scale-textured top+bottom (scale pattern motif on chest and belly panel in lighter #D8C878), accessories MUST include {kind:'dragon_hood', color matching body} (a dragon head-hat: hood with snout, teeth and horns), {kind:'wings', color matching body} and {kind:'tail'}. shoes=boots. Fierce but kid-friendly.",
      "- engel/angel: WHITE and gold look — top=dress or hoodie in white #FFFFFF with gold trim, accessories MUST include {kind:'wings', color:'#FFFFFF'} and {kind:'aura', color:'#F5C542'} (glowing halo ring).",
      "- ninja: BLACK #1F2937 fitted top+bottom, accessories MUST include {kind:'mask', color:'#111827'} and {kind:'sword', color:'#64748B'} (blades on the back), may include {kind:'belt', color:'#C0392B'}.",
      "For ANY themed request (animal, fantasy figure, profession), pick the real-world iconic costume colors and include the matching head accessory, wings/tail when the creature has them, and a motif that makes the texture read as that theme at a glance.",
      ...(input.previousOutfit ? [
        "",
        "REVISION MODE (strict): This is an EDIT of an existing outfit, NOT a new design.",
        `previousOutfit=${JSON.stringify(input.previousOutfit)}`,
        "The prompt is a change request from a child (e.g. «gjør vingene større», «bare capsen blå», «fjern sekken»).",
        "Return the FULL outfit object: copy every field from previousOutfit EXACTLY as-is, and change ONLY what the change request explicitly mentions.",
        "Do not add, remove, restyle or recolor anything that is not mentioned. Keep the accessories array identical except for the mentioned items (removals only when asked to remove).",
        "In revision mode the single-piece rule above does NOT apply — never reset unmentioned fields to none/empty.",
      ] : []),
      "",
      "Placement rule (strict):",
      placementRule,
      "Every module must include a valid `type` enum value and a six-char hex color.",
      "Keep the response compact so it is never truncated: at most 8 modules, at most 3 short notes, and concise one-sentence strings. Output the complete JSON object only.",
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

  private async askModel(prompt: string): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 6000,
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

  async generateDesign(userId: string | null, input: GenerateInput) {
    const modelResult = await this.askModel(this.buildPrompt(input, "generate"));
    this.logRawSchemaDiff(modelResult, input);
    const normalized = normalizeDesignPayload(input, modelResult);
    const design = aiValidationService.ensureDesign(normalized);
    const generationId = userId
      ? await this.saveGeneration(userId, input.prompt, "generate", design, input.style ?? null)
      : randomUUID();

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
    const design = aiValidationService.ensureDesign(normalizeDesignPayload(
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
