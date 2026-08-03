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
import { computeRetentionUntil } from "../../lib/ai-retention";
import { hashPrompt, lookupDecision } from "../../lib/safety-gateway";
import { aiValidationService } from "./ai-validation.service";
import {
  buildFaithfulnessCorrection,
  evaluateOutfitFaithfulness,
} from "../../lib/outfit-faithfulness";
import {
  modelItemsToUniversalOutfitSpec,
  universalOutfitSpecSchema,
} from "../../lib/universal-outfit";
import {
  buildConceptDivergencePrompt,
  buildConceptSelectionPrompt,
  buildCreativeCarryThroughCorrection,
  buildCreativeDirectionForBuilder,
  chooseCreativeStrategy,
  conceptDivergenceSchema,
  conceptSelectionSchema,
  evaluateCreativeCarryThrough,
  rankFinalists,
} from "../../lib/creative-intelligence";

type GenerateInput = z.infer<typeof aiGenerateRequestSchema>;
type StylizedInput = {
  prompt: string;
  avatarType?: string;
  bodyType?: string;
  style?: string;
};

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
  private buildPrompt(
    input: GenerateInput,
    mode: string,
    creativeDirection?: string,
  ): string {
    const placementRule =
      input.itemType === "classic_shirt"
        ? 'For classic_shirt: leftSleeve/rightSleeve must be descriptive strings and leftLeg/rightLeg must be exactly "not_used".'
        : 'For classic_pants: leftLeg/rightLeg must be descriptive strings and leftSleeve/rightSleeve must be exactly "not_used".';
    return [
      "Return only valid JSON. No markdown. No comments. Do not wrap in backticks.",
      `mode=${mode}`,
      `itemType=${input.itemType}`,
      `prompt=${input.prompt}`,
      `style=${input.style ?? "generated-style"}`,
      `theme=${input.theme ?? "generated-theme"}`,
      "target=roblox",
      ...(creativeDirection ? ["", creativeDirection] : []),
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
      '    "shoesColor": "#RRGGBB (the shoe color the child asked for, e.g. røde snikkers = #C0392B; omit if no color given)",',
      '    "topDescription": "short ENGLISH description of ONLY the upper-body garment fabric (color, material, pattern, small chest motif) — used to paint the clothing texture",',
      '    "bottomDescription": "short ENGLISH description of ONLY the lower-body garment fabric (color, material, pattern) — used to paint the clothing texture",',
      '    "hair": {"style": "none|short|long|ponytail|twintails|spiky|curly|braids|wavy|snakes", "color": "#RRGGBB"},',
      '    "accessories": [{"kind": "cap|beanie|hat|helmet|crown|glasses|mask|wings|backpack|bag|necklace|scarf|horns|tail|belt|gloves|unicorn_horn|dragon_hood|jetpack|sword|shoulder_guards|shoulder_pet|aura|flame_aura|pixel_aura", "color": "#RRGGBB", "size": "small|medium|large"}],',
      '    "customParts": [{"name": "string", "shape": "horn|spike|orb|plate|band|snake|fin|blob|headcover", "attach": "forehead|head_top|face|neck|chest|belly|back|hips|left_shoulder|right_shoulder|left_hand|right_hand|left_leg|right_leg|left_foot|right_foot", "color": "#RRGGBB", "size": "small|medium|large"}],',
      '    "unsupported": ["string"],',
      '    "reason": "string"',
      "  },",
      '  "universalItems": [{"id":"top-hoodie-01","category":"top|bottom|one_piece|footwear|hair|accessory","kind":"registry_kind","label":"child friendly label","color":"#RRGGBB","fit":"slim|regular|relaxed|oversized","size":"small|medium|large","material":"string","placement":"string"}]',
      "}",
      "",
      "CANONICAL ITEM RULE (strict): universalItems is REQUIRED and is the authoritative outfit. Emit one row per requested item using only registry kinds: tshirt, hoodie, oversized_hoodie, zip_hoodie, sweatshirt, jacket, bomber_jacket, varsity_jacket, blazer, trench_coat, puffer_jacket, winter_coat, football_jersey, formal_shirt, suit_jacket, kimono, armor, jeans, joggers, cargo_pants, formal_trousers, shorts, dress, shoes, boots, cap, beanie, long_hair, short_hair, curly_hair, afro_hair, dreadlocks, ponytail_hair, anime_hair, roblox_hair, backpack, shoulder_bag, wings, crown, mask, belt, helmet, scarf, tail, horns, headphones, necklace, sword, cape. Stable IDs use lowercase hyphenated category-kind-number and must be unique. A dress is category one_piece with id prefix one-piece and replaces top and bottom. Unknown items remain explicit accessory rows so routing marks them unsupported; never substitute a hoodie.",
      "Outfit rule (strict): `outfit` is non-authoritative artwork metadata and must describe the same items as universalItems.",
      "CREATIVE ENHANCEMENT rule: the Creative Direction may invent garment-integrated construction, ornament, materials, story details, and theme-defining accessories when the user gives creative freedom (for example 'make the coolest knight'). Preserve every explicit requirement. A request for one specific garment must remain one garment, but that garment should still receive the selected silhouette, hero element, and story details. Never add unrelated filler garments merely to make the JSON look complete.",
      "PLACEMENT rule (strict): every wish has a correct BODY LOCATION — head things (marshmallow head, pumpkin head, helmets, hair) belong in customParts/accessories/hair, NEVER painted on the clothes; wings/tails/backpacks are accessories on the body. topDescription/bottomDescription describe ONLY the garment surface and construction: color blocking, materials, panels, seams, closures, trim, controlled wear, and a focused motif when the Creative Direction calls for it. NEVER put a theme's literal face, eyes, mouth, melted/dripping head parts, or the creature itself into garment descriptions. Example: «marshmallow head» → customParts headcover white; topDescription may describe coordinated soft white fabric but not the face or head. If the child did not describe the clothes, follow the selected Creative Direction rather than defaulting to an arbitrary generic garment.",
      "The outfit plan is what the child SEES on the 3D avatar — when the child names ANY garment (skjorte, shirt, jakke, bukse, genser …) the matching outfit field MUST be set to that garment. skjorte/shirt WITHOUT 't-' still means top=tshirt (a shirt IS a top). Never answer with an all-none outfit while the reason says the child asked for a garment.",
      "LANGUAGE (strict): the prompt is written by a child in ANY language (Norwegian, English, Swedish, Spanish, Arabic, Ukrainian, ...) often with heavy typos — always interpret the intent regardless of language (e.g. 't-sjhortet' means t-skjorte, 'capps' means caps, 'marshmelo hed' means marshmallow head). Never refuse or misread a wish because of its language. Children often SPLIT compound garment words — 'cargo bukse'=cargobukse (bottom=pants), 'bobkel jakke'=boblejakke (top=jacket), 'hete gensr'=hettegenser (top=hoodie) — always join the pieces and map to the garment they form.",
      "Write every child-facing string (`customParts[].name`, `unsupported` entries, `reason`) in the SAME language the child wrote in.",
      "Norwegian glossary (help for the most common language): hettegenser=hoodie, genser/collegegenser=sweater, t-skjorte/skjorte=tshirt, jakke/vinterjakke=jacket, kjole=dress, skjørt=skirt, bukse/olabukse/jeans/joggebukse/cargobukse=pants, shorts=shorts, sko/joggesko/snikkers/snickers/sniekers/sneekers=sneakers (these are SHOES, shoes field — NEVER a top or shirt), støvler=boots, caps/kaps=cap, lue/luve/luva=beanie, hatt=hat, hjelm=helmet, krone=crown, briller=glasses, maske=mask, vinger=wings, ryggsekk/sekk=backpack, veske/bag=bag, kjede/halskjede=necklace, skjerf=scarf, hansker=gloves, belte=belt, hale=tail, hår=hair, bølgete hår=wavy hair, jetpack/rakettsekk=jetpack, sverd (på ryggen)=sword, skulderplater/rustning på skuldrene=shoulder_guards, liten venn/kjæledyr på skulderen=shoulder_pet, glorie/lysring/aura=aura, ildring/flammering=flame_aura, pikselgnister=pixel_aura.",
      "Full-outfit words mean top AND bottom: treningsdress/joggedress/tracksuit=jacket+pants+sneakers, dress/suit=jacket+pants, smoking/tuxedo=BLACK jacket+pants with white shirt-front motif and bow tie, fotballdrakt/football kit=tshirt+shorts+sneakers, ninja/kostyme/antrekk/outfit=top+bottom, skiklær/skidress=jacket+pants+boots, kjeledress/vinterdress/parkdress/heldress/overall/onesie=jacket+pants in the SAME color (one-piece look), pysjamas/pajamas/nattøy=tshirt+pants in soft colors. The word 'skin' alone means a complete look (top+bottom).",
      "Norwegian 'dress' and 'smoking' are SUITS (jacket+pants) — NEVER the gown garment top=dress. Only kjole/gown/ballkjole/prinsessekjole means top=dress. Vest=jacket (slim, sleeveless look), singlet/tanktop=tshirt (sleeveless look), tights/leggings/strømpebukse=pants (slim legging look, use bottom=pants) — these ARE supported, never put common garments in `unsupported`.",
      "HOOD RULE (strict): top=hoodie ONLY when the child explicitly asks for hettegenser/hoodie/hette/hood/luvtröja. For every other wish — including themed looks — use jacket, sweater, tshirt or dress. Never give a garment a hood the child did not ask for.",
      'hair.style is "none" unless the user asks for hair. accessories only contains requested items (max 6).',
      "Everything in the outfit schema (shoes, hair, all listed accessory kinds) IS supported in the 3D preview — never list those in `unsupported`. Only put something in `unsupported` when it truly cannot be represented (e.g. a specific brand logo, an animal companion).",
      "If the user only asks for one piece (e.g. only a t-shirt), set every other field to none/empty. This applies even WITHOUT the words «bare/kun»: «røde snikkers» = ONLY shoes=sneakers (top/bottom none), «rød caps» = ONLY {kind:'cap'}. NEVER add a t-shirt or other garments the child did not name. Words like «bare», «kun», 'only', 'just' make this strict too.",
      "",
      "customParts — NO LIMITS placement rule (strict): children can ask for ANYTHING anywhere on the body, and you MUST build it exactly where they say using `customParts` (max 4). Pick the closest shape + the exact attach point the child names.",
      "Examples: «horn i panna» → {name:'Horn i panna', shape:'horn', attach:'forehead'}; «horn i magen» → {shape:'horn', attach:'belly'}; «pigger på ryggen» → {shape:'spike', attach:'back'}; «magisk kule i hånda» → {shape:'orb', attach:'right_hand'}; «finner på beina» → {shape:'fin', attach:'left_leg'} + {attach:'right_leg'}.",
      "«slanger som hår» / «medusa» → hair.style='snakes' with green color (do NOT use customParts for snake hair).",
      "Fantasy HEADS (marshmallow head, pumpkin head, cheese head, robot head ...) → shape:'headcover' attach:'face' with the iconic color (marshmallow=#FFF7EE, pumpkin=#E8862E): it wraps the whole head. Example: «marshmallow head» → {name:'Marshmallow head', shape:'headcover', attach:'face', color:'#FFF7EE', size:'large'}.",
      "Never refuse a placement, never move it somewhere more 'normal', never put it in `unsupported` — the child's exact wish wins. Use customParts for anything the accessory kinds don't cover.",
      "",
      "Themed looks (strict — use the ICONIC real-world costume, correct colors are mandatory):",
      "When the prompt names ANY creature, figure, profession, character or thing to look like — in ANY language — the child wants to BE that figure. Examples: enhjørning, prinsesse, drage, ninja, superhelt, pirat, astronaut, ridder/knight/riddare, politi/police, brannmann/firefighter, lege/doctor, robot, heks/witch, vampyr/vampire, konge/king, dronning/queen, julenisse/santa, gamer, alv/elf, troll, dinosaur, iskrem/ice cream, and every similar wish. This OVERRIDES the single-piece rule: fill the FULL outfit — top AND bottom AND the theme's iconic accessories — never just a motif on a shirt, and never leave outfit fields at none for a themed request.",
      "Iconic looks for common figures (use real-world costume colors): ridder/knight=grey #9AA3AD metal-look jacket+pants, accessories helmet+sword+shoulder_guards; politi/police=dark navy #1B2A4A shirt+pants with gold badge motif, cap; brannmann/firefighter=yellow-beige #D9A441 jacket+pants with reflective grey stripes, helmet in red #C0392B; lege/doctor=white #FFFFFF coat (jacket) over blue scrubs pants; robot=grey #8D99AE metal panels top+bottom with glowing blue #38BDF8 accents, antenna via customParts; heks/witch=black #241B35 dress with purple #7C3AED accents, hat; vampyr/vampire=black #1A1A24 jacket + dark pants with red #8B0000 accents; konge/king=royal red #8B1E3F jacket with gold trim + dark pants, crown; julenisse/santa=red #C0392B jacket+pants with white trim, beanie in red, belt in black; gamer=dark jacket+pants with neon #39FF14 accents and headset (via cap or customParts).",
      "- enhjørning/unicorn: WHITE base with pastel rainbow accents (pink #F8A8C8, purple #B78BE8, turquoise #7DD8D8, gold). top=sweater or dress in white/pastel (hoodie only if the child asks for hette/hettegenser), accessories MUST include {kind:'unicorn_horn', color:'#F5C542'} (a unicorn head-hat: white ears + gold spiral horn + rainbow mane) and {kind:'tail', color:'#F8A8C8'}. Motif: rainbow/stars. NEVER dark or navy colors.",
      "- prinsesse/princess (eventyrprinsesse): a fairytale BALL GOWN — top=dress in pink #F7B6D2 or light blue #A8C8F0 with GOLD trim, fitted bodice + big voluminous skirt look, puffed sleeves. hair=long unless the user says otherwise, accessories MUST include {kind:'crown', color:'#F5C542'} (tiara) and may include {kind:'necklace'} and {kind:'gloves', color:'#FFFFFF'}. Elegant sparkle motif, NEVER dark/street colors.",
      "- drage/dragon: GREEN #3E8E4E or RED #C0392B scale-textured top+bottom (scale pattern motif on chest and belly panel in lighter #D8C878), accessories MUST include {kind:'dragon_hood', color matching body} (a dragon head-hat: hood with snout, teeth and horns), {kind:'wings', color matching body} and {kind:'tail'}. shoes=boots. Fierce but kid-friendly.",
      "- engel/angel: WHITE and gold look — top=dress or sweater in white #FFFFFF with gold trim, accessories MUST include {kind:'wings', color:'#FFFFFF'} and {kind:'aura', color:'#F5C542'} (glowing halo ring).",
      "- ninja: BLACK #1F2937 fitted top+bottom, accessories MUST include {kind:'mask', color:'#111827'} and {kind:'sword', color:'#64748B'} (blades on the back), may include {kind:'belt', color:'#C0392B'}.",
      "- astronaut/romfarer: a real NASA-style space suit — top=jacket AND bottom=pants in WHITE #F5F7FA with dark navy #1E2A44 panel lines and small orange #E8862E accents, shoes=boots (chunky moon boots, white/grey). accessories MUST include {kind:'helmet', color:'#FFFFFF'} (round space helmet with visor) and {kind:'backpack', color:'#D8DEE8'} (life-support pack). Motif: ONE round mission patch on the chest plus a small flag — the suit fabric itself stays plain white with panel seams, NEVER an all-over print of astronauts/rockets/stars. NEVER leave the outfit empty for an astronaut.",
      "For ANY themed request (animal, fantasy figure, profession), pick the real-world iconic costume colors and include the matching head accessory, wings/tail when the creature has them, and a motif that makes the texture read as that theme at a glance.",
      ...(input.previousOutfit
        ? [
            "",
            "REVISION MODE (strict): This is an EDIT of an existing outfit, NOT a new design.",
            `previousOutfit=${JSON.stringify(input.previousOutfit)}`,
            "The prompt is a change request from a child (e.g. «gjør vingene større», «bare capsen blå», «fjern sekken»).",
            "Return the FULL outfit object: copy every field from previousOutfit EXACTLY as-is, and change ONLY what the change request explicitly mentions.",
            "Do not add, remove, restyle or recolor anything that is not mentioned. Keep the accessories array identical except for the mentioned items (removals only when asked to remove).",
            "In revision mode the single-piece rule above does NOT apply — never reset unmentioned fields to none/empty.",
          ]
        : []),
      "",
      "Placement rule (strict):",
      placementRule,
      "Every module must include a valid `type` enum value and a six-char hex color.",
      "Keep the response compact so it is never truncated: at most 8 modules, at most 3 short notes, and concise one-sentence strings. Output the complete JSON object only.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  private logRawSchemaDiff(rawPayload: unknown, request: GenerateInput) {
    const source =
      rawPayload && typeof rawPayload === "object" && "result" in rawPayload
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
          {
            role: "system",
            content:
              "You are the My Skins structured Roblox design engine. Always return JSON only.",
          },
          { role: "user", content: prompt },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        lastError = new SyntaxError("AI returned empty content");
        continue;
      }
      try {
        return parseStrictJson(content);
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new SyntaxError("AI returned non-JSON content");
        console.error("ai.model.invalid_json", { attempt, error: lastError });
      }
    }

    throw lastError ?? new SyntaxError("AI returned non-JSON content");
  }

  private async createCreativeDirection(input: GenerateInput) {
    const strategy = chooseCreativeStrategy(input);
    if (!strategy) return null;
    const divergence = conceptDivergenceSchema.parse(
      await this.askModel(
        buildConceptDivergencePrompt({
          prompt: input.prompt,
          style: input.style,
          theme: input.theme,
          conceptCount: strategy.conceptCount,
        }),
      ),
    );
    if (divergence.concepts.length !== strategy.conceptCount)
      throw new Error(
        `Creative director returned ${divergence.concepts.length} concepts; expected ${strategy.conceptCount}`,
      );
    const selection = conceptSelectionSchema.parse(
      await this.askModel(
        buildConceptSelectionPrompt({
          prompt: input.prompt,
          concepts: divergence.concepts,
          finalistCount: strategy.finalistCount,
        }),
      ),
    );
    if (selection.finalists.length !== strategy.finalistCount)
      throw new Error(
        `Creative jury returned ${selection.finalists.length} finalists; expected ${strategy.finalistCount}`,
      );
    const candidateIds = new Set(
      divergence.concepts.map((concept) => concept.id),
    );
    const finalistIds = new Set<string>();
    for (const finalist of selection.finalists) {
      if (!candidateIds.has(finalist.id))
        throw new Error(
          `Creative jury invented unknown finalist ${finalist.id}`,
        );
      if (finalistIds.has(finalist.id))
        throw new Error(`Creative jury duplicated finalist ${finalist.id}`);
      finalistIds.add(finalist.id);
    }
    const ranked = rankFinalists(selection.finalists);
    const winner = ranked[0];
    if (!winner) throw new Error("Creative jury returned no winning concept");
    return {
      interpretedIntent: divergence.interpretedIntent,
      audience: divergence.audience,
      strategy,
      conceptsGenerated: divergence.concepts.length,
      finalists: ranked.map(({ concept }) => concept),
      selected: winner.concept,
      builderDirection: buildCreativeDirectionForBuilder(winner.concept),
    };
  }

  private async saveGeneration(
    userId: string,
    prompt: string,
    type: string,
    result: unknown,
    style: string | null = null,
    requestedGenerationId?: string,
  ) {
    const generationId = requestedGenerationId ?? randomUUID();
    // `prompt` is already the SafetyGateway-normalized safe form (the gateway
    // rewrites req.body in place). Store its hash + policy decision alongside.
    const decision = lookupDecision(prompt);
    await db.insert(aiGenerationsTable).values({
      id: generationId,
      userId,
      prompt,
      promptHash: decision?.promptHash ?? hashPrompt(prompt),
      safetyDecision: decision?.decision ?? "allowed",
      result: JSON.stringify(result),
      type,
      style,
      retentionUntil: computeRetentionUntil(),
    });
    return generationId;
  }

  async generateDesign(userId: string | null, input: GenerateInput, requestedGenerationId?: string) {
    const creative = input.previousOutfit
      ? null
      : await this.createCreativeDirection(input);
    let modelResult = await this.askModel(
      this.buildPrompt(input, "generate", creative?.builderDirection),
    );
    let creativeCarryThrough = creative
      ? evaluateCreativeCarryThrough(creative.selected, modelResult)
      : null;
    if (creative) {
      if (!creativeCarryThrough!.passed) {
        console.warn("ai.creative_carry_through_retry", {
          missing: creativeCarryThrough!.missing,
          conceptId: creative.selected.id,
        });
        modelResult = await this.askModel(
          `${this.buildPrompt(input, "generate", creative.builderDirection)}\n\n${buildCreativeCarryThroughCorrection(creative.selected, creativeCarryThrough!)}`,
        );
        creativeCarryThrough = evaluateCreativeCarryThrough(
          creative.selected,
          modelResult,
        );
      }
    }
    this.logRawSchemaDiff(modelResult, input);
    const normalized = normalizeDesignPayload(input, modelResult);
    let design = aiValidationService.ensureDesign(normalized);
    let modelItems = (modelResult as { universalItems?: unknown })
      .universalItems;

    // Safety net: a request must never come back with a COMPLETELY empty 3D
    // outfit (no top, no bottom, no accessories, no custom parts, no hair) —
    // that is wrong for every prompt. Retry once with a corrective instruction.
    type OutfitLike = {
      top?: string;
      bottom?: string;
      shoes?: string;
      accessories?: unknown[];
      customParts?: unknown[];
      hair?: { style?: string };
    };
    const isOutfitEmpty = (o: OutfitLike | undefined) =>
      !o ||
      ((o.top ?? "none") === "none" &&
        (o.bottom ?? "none") === "none" &&
        (o.shoes ?? "none") === "none" &&
        (o.accessories ?? []).length === 0 &&
        (o.customParts ?? []).length === 0 &&
        (o.hair?.style ?? "none") === "none");
    const outfit = (design as { outfit?: OutfitLike }).outfit;
    if (!input.previousOutfit && isOutfitEmpty(outfit)) {
      console.warn("ai.outfit_empty_retry", { prompt: input.prompt });
      const correctivePrompt = `${this.buildPrompt(input, "generate", creative?.builderDirection)}\n\nIMPORTANT CORRECTION: your previous answer left the 3D outfit COMPLETELY empty (no top, no bottom, no accessories). That is always wrong — the child asked for a look. If the prompt names any figure, creature, profession or theme, fill outfit.top, outfit.bottom, outfit.shoes and the theme's iconic accessories per the rules above. If it names specific garments, set exactly those. Never return an all-none outfit.`;
      const retryResult = await this.askModel(correctivePrompt);
      this.logRawSchemaDiff(retryResult, input);
      const retryDesign = aiValidationService.ensureDesign(
        normalizeDesignPayload(input, retryResult),
      );
      const retryOutfit = (retryDesign as { outfit?: OutfitLike }).outfit;
      if (!isOutfitEmpty(retryOutfit)) {
        design = retryDesign;
        modelResult = retryResult;
        modelItems = (retryResult as { universalItems?: unknown })
          .universalItems;
      }
    }
    // Schema-valid model output may still omit requested pieces. Validate the
    // normalized plan against deterministic multilingual requirements, retry
    // once with exact corrections, and retain only a better-scoring result.
    const candidateOutfit = (design as { outfit?: OutfitLike }).outfit;
    let faithfulness =
      candidateOutfit && !isOutfitEmpty(candidateOutfit)
        ? evaluateOutfitFaithfulness(
            input.prompt,
            candidateOutfit as Parameters<typeof evaluateOutfitFaithfulness>[1],
          )
        : null;
    const repairHistory: Array<{
      attempt: number;
      changedPaths: string[];
      previousScore: number;
      resultingScore: number;
    }> = [];
    if (
      !input.previousOutfit &&
      candidateOutfit &&
      !isOutfitEmpty(candidateOutfit)
    ) {
      const report = faithfulness!;
      if (!report.ok) {
        console.warn("ai.outfit_faithfulness_retry", {
          requirements: report.requirements,
          issueCount: report.issues.length,
          score: report.score,
        });
        const retryResult = await this.askModel(
          `${this.buildPrompt(input, "generate", creative?.builderDirection)}\n\n${buildFaithfulnessCorrection(report)}`,
        );
        const retryDesign = aiValidationService.ensureDesign(
          normalizeDesignPayload(input, retryResult),
        );
        const retryOutfit = (retryDesign as { outfit?: OutfitLike }).outfit;
        if (retryOutfit && !isOutfitEmpty(retryOutfit)) {
          const retryReport = evaluateOutfitFaithfulness(
            input.prompt,
            retryOutfit as Parameters<typeof evaluateOutfitFaithfulness>[1],
          );
          repairHistory.push({
            attempt: 1,
            changedPaths: retryReport.score > report.score ? ["items"] : [],
            previousScore: report.score,
            resultingScore: retryReport.score,
          });
          if (retryReport.score > report.score) {
            design = retryDesign;
            modelResult = retryResult;
            modelItems = (retryResult as { universalItems?: unknown })
              .universalItems;
            faithfulness = retryReport;
          }
        }
      }
    }
    if (creative)
      creativeCarryThrough = evaluateCreativeCarryThrough(
        creative.selected,
        modelResult,
      );
    const generationId = userId
      ? await this.saveGeneration(
          userId,
          input.prompt,
          "generate",
          design,
          input.style ?? null,
          requestedGenerationId,
        )
      : randomUUID();

    if (!modelItems)
      throw new Error("AI response omitted canonical universalItems");
    const outfitSpec = universalOutfitSpecSchema.parse(
      modelItemsToUniversalOutfitSpec({
        generationId,
        prompt: input.prompt,
        style: design.style,
        palette: design.colorPalette,
        items: modelItems,
        faithfulness: faithfulness
          ? { score: faithfulness.score, issues: faithfulness.issues }
          : { score: 0, issues: ["No faithful outfit was produced"] },
        repairHistory,
      }),
    );
    const allUnsupported = outfitSpec.items.every(
      (item) => item.unsupported.state,
    );
    // Structural generation is never visual proof. Only /ai/visual-review may
    // promote a supported result after five current browser renders.
    const finalSkinStatus = allUnsupported ? "UNSUPPORTED" : "NEEDS_REPAIR";
    return {
      meta: {
        generationId,
        status: "degraded",
        warnings: [
          ...outfitSpec.quality.failureReasons,
          ...(creativeCarryThrough && !creativeCarryThrough.passed
            ? [
                `Selected design direction is not fully materialized: ${creativeCarryThrough.missing.join(", ")}`,
              ]
            : []),
          ...(!allUnsupported
            ? ["Five-view browser visual acceptance is required before READY"]
            : []),
        ],
        creativeIntelligence: creative
          ? {
              mode: creative.strategy.mode,
              conceptsGenerated: creative.conceptsGenerated,
              finalistsEvaluated: creative.finalists.length,
              selectedConceptId: creative.selected.id,
              selectedConceptTitle: creative.selected.title,
            }
          : null,
      },
      result: design,
      outfitSpec,
      finalSkinStatus,
      creativeDirection: creative
        ? {
            interpretedIntent: creative.interpretedIntent,
            audience: creative.audience,
            selected: {
              id: creative.selected.id,
              title: creative.selected.title,
              story: creative.selected.story,
              audienceInsight: creative.selected.audienceInsight,
              silhouette: creative.selected.silhouette,
              heroElement: creative.selected.heroElement,
              palette: creative.selected.palette,
              materials: creative.selected.materials,
              garmentDirection: creative.selected.garmentDirection,
              accessoryDirection: creative.selected.accessoryDirection,
              textureDirection: creative.selected.textureDirection,
              improvements: creative.selected.improvements,
            },
            finalists: creative.finalists.map((concept) => ({
              id: concept.id,
              title: concept.title,
            })),
          }
        : null,
      lifecycle: allUnsupported
        ? "unsupported"
        : "external_verification_required",
    } as const;
  }

  async improveDesign(
    userId: string,
    instruction: string,
    source: unknown,
    mode: "improve" | "remix",
  ) {
    const designSource = aiValidationService.ensureDesign(source);
    const modelResult = await this.askModel(
      `${mode} this design with instruction: ${instruction}\nsource:${JSON.stringify(designSource)}`,
    );
    this.logRawSchemaDiff(modelResult, {
      prompt: instruction,
      itemType: designSource.itemType,
      style: designSource.style,
      theme: designSource.theme,
    });
    const design = aiValidationService.ensureDesign(
      normalizeDesignPayload(
        {
          prompt: instruction,
          itemType: designSource.itemType,
          style: designSource.style,
          theme: designSource.theme,
        },
        modelResult,
      ),
    );
    const generationId = await this.saveGeneration(
      userId,
      instruction,
      mode,
      design,
      null,
    );
    return aiDesignResponseSchema.parse({
      meta: { generationId, status: "completed", warnings: [] },
      result: design,
    });
  }

  async generateIdea(input: GenerateInput) {
    return aiIdeaSchema.parse(
      await this.askModel(this.buildPrompt(input, "idea")),
    );
  }

  async generateModules(input: GenerateInput) {
    return aiValidationService.ensureModules(
      await this.askModel(this.buildPrompt(input, "modules")),
    );
  }

  async generatePalette(input: GenerateInput) {
    return aiValidationService.ensurePalette(
      await this.askModel(this.buildPrompt(input, "palette")),
    );
  }

  async generateLayout(input: GenerateInput) {
    return aiValidationService.ensureLayout(
      await this.askModel(this.buildPrompt(input, "layout")),
    );
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
    const generationId = await this.saveGeneration(
      userId,
      input.prompt,
      "stylized_outfit",
      concept,
      input.style ?? null,
    );
    return stylizedOutfitResponseSchema.parse({
      meta: { generationId, status: "completed", warnings: [] },
      result: concept,
    });
  }
}

export const aiGenerationService = new AiGenerationService();
