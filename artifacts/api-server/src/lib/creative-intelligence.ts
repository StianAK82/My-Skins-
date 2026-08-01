import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9A-F]{6}$/);
const score = z.number().int().min(0).max(100);

export const creativeConceptSchema = z
  .object({
    id: z.string().regex(/^concept-[0-9]{2}$/),
    title: z.string().min(3).max(80),
    story: z.string().min(20).max(500),
    audienceInsight: z.string().min(10).max(300),
    silhouette: z
      .object({
        primaryShape: z.string().min(3).max(160),
        largeForms: z.array(z.string().min(2).max(120)).min(2).max(5),
        secondaryForms: z.array(z.string().min(2).max(120)).min(2).max(6),
        asymmetry: z.string().min(3).max(160),
        thumbnailRead: z.string().min(3).max(160),
      })
      .strict(),
    heroElement: z
      .object({
        name: z.string().min(2).max(80),
        description: z.string().min(10).max(300),
        bodyLocation: z.string().min(2).max(80),
        memoryHook: z.string().min(10).max(200),
      })
      .strict(),
    palette: z.array(hexColor).min(3).max(6),
    materials: z.array(z.string().min(2).max(100)).min(2).max(6),
    garmentDirection: z.array(z.string().min(3).max(160)).min(2).max(8),
    accessoryDirection: z.array(z.string().min(3).max(160)).max(6),
    textureDirection: z.array(z.string().min(3).max(160)).min(2).max(6),
    explicitRequirements: z.array(z.string().min(1).max(160)).max(12),
  })
  .strict();

export const conceptDivergenceSchema = z
  .object({
    interpretedIntent: z.string().min(10).max(500),
    audience: z
      .object({
        ageBand: z.literal("child_8_12"),
        desiredEmotion: z.string().min(3).max(120),
        delightPrinciples: z.array(z.string().min(3).max(160)).min(3).max(8),
      })
      .strict(),
    concepts: z.array(creativeConceptSchema).min(1).max(10),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expected = Array.from(
      { length: value.concepts.length },
      (_, index) => `concept-${String(index + 1).padStart(2, "0")}`,
    );
    const received = value.concepts.map((concept) => concept.id);
    if (
      received.length !== new Set(received).size ||
      expected.some((id) => !received.includes(id))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["concepts"],
        message:
          "Concept IDs must be the unique sequence concept-01 through concept-10",
      });
    }
  });

export const internalPreferenceSignalsSchema = z
  .object({
    promptFaithfulness: score,
    childWow: score,
    silhouetteStrength: score,
    heroElementStrength: score,
    storytelling: score,
    originality: score,
    robloxReadability: score,
    buildability: score,
  })
  .strict();

export const refinedConceptSchema = creativeConceptSchema
  .extend({
    improvements: z.array(z.string().min(3).max(180)).min(2).max(8),
    critique: z.string().min(10).max(400),
    internalPreferenceSignals: internalPreferenceSignalsSchema,
  })
  .strict();

export const conceptSelectionSchema = z
  .object({
    finalists: z.array(refinedConceptSchema).min(1).max(3),
  })
  .strict();

export type CreativeConcept = z.infer<typeof creativeConceptSchema>;
export type RefinedConcept = z.infer<typeof refinedConceptSchema>;
export type InternalPreferenceSignals = z.infer<
  typeof internalPreferenceSignalsSchema
>;

const PREFERENCE_WEIGHTS: Record<keyof InternalPreferenceSignals, number> = {
  promptFaithfulness: 0.2,
  childWow: 0.2,
  silhouetteStrength: 0.14,
  heroElementStrength: 0.14,
  storytelling: 0.1,
  originality: 0.09,
  robloxReadability: 0.08,
  buildability: 0.05,
};

function internalPreferenceValue(signals: InternalPreferenceSignals): number {
  return Object.entries(PREFERENCE_WEIGHTS).reduce(
    (total, [key, weight]) =>
      total + signals[key as keyof InternalPreferenceSignals] * weight,
    0,
  );
}

export function rankFinalists(finalists: RefinedConcept[]) {
  return finalists
    .map((concept) => ({
      concept,
      preference: internalPreferenceValue(concept.internalPreferenceSignals),
    }))
    .sort(
      (a, b) =>
        b.preference - a.preference || a.concept.id.localeCompare(b.concept.id),
    );
}

export type CreativeStrategy = {
  conceptCount: number;
  finalistCount: number;
  mode: "focused" | "exploratory";
};

export function chooseCreativeStrategy(input: {
  prompt: string;
  previousOutfit?: unknown;
}): CreativeStrategy | null {
  if (input.previousOutfit) return null;
  const text = input.prompt.normalize("NFKC").toLocaleLowerCase("nb-NO");
  const openEnded =
    /\b(kul(?:t|este)?|rå(?:tt|este)?|episk|fantastisk|unik|original|overrask|beste|verdens|cool|coolest|epic|amazing|awesome|unique|original|surprise|best)\b/u.test(
      text,
    ) ||
    /\b(lag|make|design|skap|create)\b.{0,30}\b(ridder|knight|prinsesse|princess|pirat|pirate|robot|helt|hero|monster|viking)\b/u.test(
      text,
    );
  return openEnded
    ? { conceptCount: 8, finalistCount: 3, mode: "exploratory" }
    : { conceptCount: 3, finalistCount: 1, mode: "focused" };
}

export function buildConceptDivergencePrompt(input: {
  prompt: string;
  style?: string;
  theme?: string;
  conceptCount: number;
}) {
  return [
    "You are the My Skins Fashion Director and Creative Director.",
    "Think like an elite character concept artist designing for a child aged 8-12, not like an asset picker or JSON form filler.",
    `Develop exactly ${input.conceptCount} genuinely different internal concepts before any Roblox asset or schema decision is made.`,
    "Use design psychology: silhouette communicates power and personality; one memorable hero element creates recognition; controlled contrast improves thumbnail readability; asymmetry creates energy; large, medium and small forms create hierarchy; details must support rather than bury the idea.",
    "Every concept needs a story, a silhouette-first plan, one dominant hero element, an audience insight, coherent materials, and a reason a child would say WOW.",
    "Invent tasteful details when the request is vague, while preserving every explicit user requirement when it is specific.",
    "Known entertainment or brand references are inspiration-analysis only: abstract general design principles and create an original, clearly distinct result. Never reproduce logos, exact costumes, signature symbols, or protected character identity.",
    "Do not choose registry assets and do not constrain the concepts to existing primitives. A later construction stage will solve implementation.",
    `userPrompt=${input.prompt}`,
    `styleHint=${input.style ?? "open creative direction"}`,
    `themeHint=${input.theme ?? "infer from the request"}`,
    "Return strict JSON only.",
    "Top-level fields: interpretedIntent, audience, concepts.",
    'audience must be {"ageBand":"child_8_12","desiredEmotion":"...","delightPrinciples":[...]}.',
    `concepts must contain exactly ${input.conceptCount} entries with sequential IDs beginning at concept-01.`,
    "Each concept requires: id, title, story, audienceInsight, silhouette {primaryShape, largeForms, secondaryForms, asymmetry, thumbnailRead}, heroElement {name, description, bodyLocation, memoryHook}, palette, materials, garmentDirection, accessoryDirection, textureDirection, explicitRequirements.",
  ].join("\n");
}

export function buildConceptSelectionPrompt(input: {
  prompt: string;
  concepts: CreativeConcept[];
  finalistCount: number;
}) {
  return [
    "You are the independent Design Taste Jury for My Skins.",
    `Select the ${input.finalistCount} strongest concept${input.finalistCount === 1 ? "" : "s"}, critique ${input.finalistCount === 1 ? "it" : "them"} honestly, and improve ${input.finalistCount === 1 ? "it" : "each one"}. Do not reward completeness, verbosity, or technical metadata. Reward taste.`,
    "Judge whether a child would remember and want the design, whether its silhouette reads at Roblox thumbnail size, whether one hero element dominates, whether the story is visible rather than merely written, and whether it is original without copying protected designs.",
    "Penalize generic costume checklists, excessive detail everywhere, muddy palettes, weak silhouettes, multiple competing hero elements, and concepts that only sound exciting in prose.",
    "Prompt faithfulness and child delight are the highest priorities. Buildability matters, but must not force the idea into a generic existing asset.",
    `originalUserPrompt=${input.prompt}`,
    `candidateConcepts=${JSON.stringify(input.concepts)}`,
    "Return strict JSON only with one field: finalists.",
    `finalists must contain exactly ${input.finalistCount} improved concept${input.finalistCount === 1 ? "" : "s"} copied from the candidates with original IDs.`,
    "Each finalist must retain every concept field and add improvements, critique, and internalPreferenceSignals.",
    "internalPreferenceSignals are private pairwise-selection signals, never a quality rating for the final skin. They must contain integers 0-100 for promptFaithfulness, childWow, silhouetteStrength, heroElementStrength, storytelling, originality, robloxReadability, and buildability.",
  ].join("\n");
}

export function buildCreativeDirectionForBuilder(winner: RefinedConcept) {
  return [
    "CREATIVE DIRECTION (authoritative; implement this design rather than replacing it with a generic costume):",
    `Concept: ${winner.title}`,
    `Story: ${winner.story}`,
    `Audience insight: ${winner.audienceInsight}`,
    `Primary silhouette: ${winner.silhouette.primaryShape}`,
    `Large forms: ${winner.silhouette.largeForms.join("; ")}`,
    `Secondary forms: ${winner.silhouette.secondaryForms.join("; ")}`,
    `Asymmetry: ${winner.silhouette.asymmetry}`,
    `Thumbnail read: ${winner.silhouette.thumbnailRead}`,
    `Hero element: ${winner.heroElement.name} — ${winner.heroElement.description} at ${winner.heroElement.bodyLocation}. ${winner.heroElement.memoryHook}`,
    `Palette: ${winner.palette.join(", ")}`,
    `Materials: ${winner.materials.join("; ")}`,
    `Garment direction: ${winner.garmentDirection.join("; ")}`,
    `Accessory direction: ${winner.accessoryDirection.join("; ") || "none"}`,
    `Texture direction: ${winner.textureDirection.join("; ")}`,
    "Preserve the hero element and silhouette hierarchy in universalItems, outfit descriptions, modules, accessories and customParts. Use supported representation where possible; disclose any part that cannot yet be materialized instead of silently substituting a generic hoodie.",
  ].join("\n");
}

const keywords = (text: string) =>
  text
    .toLocaleLowerCase("en-US")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 5);

export type CreativeCarryThrough = {
  passed: boolean;
  evidence: {
    palette: boolean;
    heroElement: boolean;
    silhouetteOrMaterial: boolean;
  };
  missing: string[];
};

/** Verifies that creative direction survived planning; visual fidelity is reviewed later from renders. */
export function evaluateCreativeCarryThrough(
  winner: RefinedConcept,
  builderResult: unknown,
): CreativeCarryThrough {
  const serialized = JSON.stringify(builderResult).toLocaleLowerCase("en-US");
  const palette = winner.palette.some((color) =>
    serialized.includes(color.toLocaleLowerCase("en-US")),
  );
  const heroWords = keywords(
    `${winner.heroElement.name} ${winner.heroElement.description}`,
  );
  const heroElement = heroWords.some((word) => serialized.includes(word));
  const constructionWords = keywords(
    `${winner.silhouette.primaryShape} ${winner.silhouette.largeForms.join(" ")} ${winner.materials.join(" ")}`,
  );
  const silhouetteOrMaterial = constructionWords.some((word) =>
    serialized.includes(word),
  );
  const missing = [
    ...(!palette ? ["selected palette"] : []),
    ...(!heroElement ? ["hero element"] : []),
    ...(!silhouetteOrMaterial ? ["silhouette or material direction"] : []),
  ];
  return {
    passed: missing.length === 0,
    evidence: { palette, heroElement, silhouetteOrMaterial },
    missing,
  };
}

export function buildCreativeCarryThroughCorrection(
  winner: RefinedConcept,
  report: CreativeCarryThrough,
) {
  return [
    "CREATIVE CARRY-THROUGH REPAIR: the structured build lost parts of the selected design direction.",
    `Missing: ${report.missing.join(", ")}.`,
    `Preserve hero element '${winner.heroElement.name}', palette ${winner.palette.join(", ")}, silhouette '${winner.silhouette.primaryShape}', and materials ${winner.materials.join(", ")}.`,
    "Return the complete build JSON again. Encode the direction in actual universalItems, materials, designElements, placement, modules, outfit descriptions, accessories, and customParts as appropriate; do not merely repeat it in the title or reason.",
  ].join("\n");
}
