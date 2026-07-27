import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { editImageBuffers } from "@workspace/integrations-openai-ai-server";
import {
  enhanceGarmentPrompt,
  formatEnhancedPrompt,
} from "./classic-prompt-enhancer";
import { planGarmentBlueprint } from "./garment-blueprint";
import {
  composeGarmentFingerprint,
  validateGarmentFingerprint,
} from "./garment-composer";
import { getLearnedDesignInstructions } from "./design-memory-feedback.service";
import { buildMaterialPrompt } from "./material-generator.ts";
import {
  planOutfitDNA,
  understandFashionIntent,
  type OutfitDNA,
} from "./outfit-dna.ts";
import { inspectGarment } from "./quality-inspector.ts";
import type { EnhancedGarmentSpecification } from "./classic-prompt-enhancer";
import {
  AiGenerationError,
  normalizeAiError,
  timeoutMs,
  withAiTimeout,
} from "./ai-errors";

export {
  CLASSIC_REGIONS,
  CLASSIC_TEXTURE_SIZE,
  resizeToAtlas,
} from "./classic-atlas";
import {
  CLASSIC_REGIONS,
  CLASSIC_TEXTURE_SIZE,
  decodePng,
  encodeRgba,
  resizeToAtlas,
  type ClassicGarment,
} from "./classic-atlas";
export type { ClassicGarment } from "./classic-atlas";

function referencePng(type: ClassicGarment, guide: boolean): Buffer {
  const { width, height } = CLASSIC_TEXTURE_SIZE,
    pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const region = CLASSIC_REGIONS[type].find(
        (r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height,
      );
      if (!region) continue;
      const i = CLASSIC_REGIONS[type].indexOf(region),
        o = (y * width + x) * 4,
        colors = [
          [67, 97, 238],
          [20, 184, 166],
          [168, 85, 247],
          [245, 158, 11],
        ],
        c = colors[i % 4];
      pixels[o] = guide ? c[0] : 238;
      pixels[o + 1] = guide ? c[1] : 238;
      pixels[o + 2] = guide ? c[2] : 238;
      pixels[o + 3] = guide ? 72 : 255;
    }
  return encodeRgba(width, height, pixels);
}

export function buildClassicTexturePrompt(
  type: ClassicGarment,
  description: string,
  enhanced = enhanceGarmentPrompt(type, description),
  correction?: string,
  hasReferences = false,
  learned: string[] = [],
): string {
  const panelContinuity =
    type === "shirt"
      ? "The torso front may contain the requested zipper, buttons, placket, chest pockets, graphic or hood opening. The torso back must instead show credible rear construction: rear yoke or panel seams, shoulder continuation, rear folds and the back of the hood where applicable. Never mirror or copy the torso front. Build left and right arms as separate physical panels; continue shoulder, underarm, cuff, stripe and fabric details around each sleeve without cloning one sleeve onto the other."
      : "The waist front may contain the requested fly, closure, curved pockets, pleats or drawcord construction. The waist back must instead show credible rear construction: yoke or seat shaping, rear pockets, waistband continuation and rear folds. Never mirror or copy the waist front. Continue side seams, inseams, pocket edges, knee panels, fabric grain and wear naturally from hips through the distinct front and rear leg panels without cloning legs.";
  return [
    "ROLE AND OUTPUT: You are a professional game-clothing texture artist creating one production-ready Roblox Classic UV texture atlas. You are creating a UV texture atlas for a game character. You are NOT creating an illustration. You are NOT creating concept art. You are NOT creating a clothing advertisement. You are painting directly onto the supplied UV layout. Return only one flat transparent PNG at the supplied atlas proportions; never show the atlas as an object or scene.",
    `SOURCE PRIORITY: Preserve the user's design exactly: ${description}`,
    `CONSTRUCTION SPECIFICATION:\n${formatEnhancedPrompt(enhanced)}`,
    learned.length
      ? `LEARNED QUALITY ADJUSTMENTS (derived from aggregate reviews of prior ${enhanced.designMemory.garmentKey} results): ${learned.join(" ")}`
      : "",
    `UV PAINTING CONTRACT: Image 1 is the blank editable atlas. Image 2 is only a positional region guide and must not be visible in the result. Paint every ${type} island completely in place. Required physical panels: ${CLASSIC_REGIONS[type].map((region) => region.name).join(", ")}. Each island is a different physical garment panel that wraps around a 3D avatar. Respect its position, orientation and role. Keep every pixel outside valid clothing islands transparent. Do not move, crop, merge, rotate, label or redraw the islands.`,
    `PANEL DIFFERENTIATION AND CONTINUITY: ${panelContinuity}`,
    "TAILORING STANDARD: Construct the garment rather than depicting it. Resolve fabric grain at believable scale; shaped panels; finished openings; collars, hoods, cuffs and waistbands with thickness; functional pockets and closures; seam allowances implied by precise topstitching; double stitching or flatlock stitching where appropriate; folds caused by gravity, drape, compression and fabric tension; and subtle structural shading contained inside the garment. Align seams and patterns wherever adjacent UV panels meet. Construction must remain coherent from front to side to back.",
    "COLOUR AND MATERIAL DEPTH: Do not use flat colour fills. Within the requested palette, add restrained tonal variation, weave or grain, natural material highlights, contact shading at seams, clean wear patterns, stitch contrast and slight edge wear appropriate to the specified fabric. Keep the garment clean. Material response must control fold shape and highlight width: never substitute generic airbrushed shading, plastic shine or photographic lighting.",
    enhanced.decorativeDetails.length || enhanced.visibleText
      ? "GRAPHICS AND EMBROIDERY: Render requested artwork as physically printed ink, woven applique or embroidery attached to the fabric surface. It must follow fabric grain, folds, perspective and panel orientation; respect seams and openings; remain correctly scaled; and never float, look pasted on, stretch across unrelated islands or cover construction incorrectly."
      : "SURFACE ARTWORK: Add no unrequested graphics, symbols, logos, lettering or numbers.",
    enhanced.visibleText
      ? `TEXT: Render only ${enhanced.visibleText}, with exact spelling and placement. Add no other letters, words, numbers or logos.`
      : "TEXT: No visible letters, words, numbers, logos or brand marks anywhere.",
    "ABSOLUTE FAILURE CONDITIONS: Do not include a person, human, body, avatar, character, fashion model, mannequin, hanger, clothing photograph, catalogue image, product photo, studio lighting, isolated garment, floating clothing, 3D render, real-world photograph, illustration, concept art, background, wall, table, floor, reflection, cast shadow outside the garment, opaque pixels outside UV islands, watermark, signature, caption, template marking, label, guide colour, guide outline, copied region, repeated motif caused by generation, symmetrical duplication, identical sleeves, identical legs, or identical front and back. Any one of these makes the result invalid.",
    hasReferences
      ? "QUALITY REFERENCES: Use additional project images only to understand professional fabric rendering, tailoring detail and construction density. Never copy their design, palette, graphics, text, logos, layout or garment identity."
      : "",
    correction
      ? `MANDATORY CORRECTION FROM THE PREVIOUS FAILED ATTEMPT: ${correction}. Repaint the affected physical panels with genuine, coherent garment construction rather than concealing the defect.`
      : "",
    "INTERNAL PRE-FLIGHT INSPECTION: Before returning, silently inspect the complete atlas. Ask: Did I create any photograph, scene, person, avatar, mannequin, hanger, floating garment or 3D object? Is every required UV island fully painted? Are transparency and island positions preserved? Did I copy the front onto the back, duplicate sleeves or legs, reverse panel roles, leave flat or blank faces, break seam continuity, paste graphics over construction, misspell requested text, or leave guide colours or markings? If any answer indicates failure, correct and regenerate internally before returning.",
    "FINAL RESPONSE: Return only the completed PNG UV atlas. No explanation, mockup, preview, border or alternate version.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function validateClassicTexture(
  type: ClassicGarment,
  png: Buffer,
  blank = referencePng(type, false),
): string[] {
  const failures: string[] = [];
  let image;
  try {
    image = decodePng(png);
  } catch {
    return ["image must decode successfully as a PNG"];
  }
  if (image.width !== 585 || image.height !== 559)
    failures.push("output dimensions must be exactly 585 x 559");
  if (png.equals(blank))
    failures.push("output is byte-identical to the blank template");
  const colors = new Map<string, number>();
  for (let i = 0; i < image.rgba.length; i += 4) {
    if (image.rgba[i + 3] > 16) {
      const key = `${image.rgba[i] >> 4},${image.rgba[i + 1] >> 4},${image.rgba[i + 2] >> 4}`;
      colors.set(key, (colors.get(key) ?? 0) + 1);
    }
  }
  if (Math.max(0, ...colors.values()) > image.width * image.height * 0.9)
    failures.push("output is almost entirely one flat colour");
  const guide = [
    [67, 97, 238],
    [20, 184, 166],
    [168, 85, 247],
    [245, 158, 11],
  ];
  let guidePixels = 0;
  for (const r of CLASSIC_REGIONS[type]) {
    let covered = 0,
      varied = new Set<string>();
    for (let y = r.y; y < r.y + r.height; y += 3)
      for (let x = r.x; x < r.x + r.width; x += 3) {
        const o = (y * image.width + x) * 4;
        if (image.rgba[o + 3] > 32) covered++;
        varied.add(
          `${image.rgba[o] >> 4},${image.rgba[o + 1] >> 4},${image.rgba[o + 2] >> 4}`,
        );
        if (
          guide.some(
            (c) =>
              Math.abs(image.rgba[o] - c[0]) < 8 &&
              Math.abs(image.rgba[o + 1] - c[1]) < 8 &&
              Math.abs(image.rgba[o + 2] - c[2]) < 8,
          )
        )
          guidePixels++;
      }
    const samples = Math.ceil(r.width / 3) * Math.ceil(r.height / 3);
    if (covered / samples < 0.55)
      failures.push(`${r.name} has insufficient non-transparent coverage`);
    if (varied.size < 3) failures.push(`${r.name} appears blank or flat`);
  }
  if (guidePixels > 250)
    failures.push("coloured region-guide pixels remain visible");
  return failures;
}

async function qualityReferences(type: ClassicGarment) {
  const configured = process.env.AI_QUALITY_REFERENCES_DIR;
  const roots = [
    configured,
    resolve(process.cwd(), "assets/ai-references"),
    resolve(process.cwd(), "artifacts/api-server/assets/ai-references"),
  ].filter(Boolean) as string[];
  for (const root of roots) {
    try {
      const dir = resolve(root, type),
        names = (await readdir(dir))
          .filter((n) => n.toLowerCase().endsWith(".png"))
          .sort()
          .slice(0, 3);
      if (names.length)
        return Promise.all(
          names.map(async (filename) => ({
            data: await readFile(resolve(dir, filename)),
            filename: `quality-${type}-${filename}`,
          })),
        );
    } catch {
      /* Optional by design. */
    }
  }
  return [];
}

export async function generateClassicTexture(
  type: ClassicGarment,
  description: string,
  preparedSpecification?: EnhancedGarmentSpecification,
  diagnostics?: {
    generationId: string;
    startedAt: number;
    log: (event: string, data: Record<string, unknown>) => void;
  },
  sharedDNA?: OutfitDNA,
) {
  const blank = referencePng(type, false),
    guide = referencePng(type, true),
    enhanced =
      preparedSpecification ??
      (await withAiTimeout(
        () => planGarmentBlueprint(type, description),
        timeoutMs("AI_TEXT_TIMEOUT_MS", 20_000),
        `${type}_planning`,
      )),
    references = await qualityReferences(type),
    dna =
      sharedDNA ??
      planOutfitDNA(
        understandFashionIntent(`${enhanced.garmentType} ${description}`),
      );
  let learned: string[] = [];
  try {
    learned = await getLearnedDesignInstructions(
      enhanced.designMemory.garmentKey,
    );
  } catch {
    /* Feedback memory is optional when the database is unavailable. */
  }
  let raw: Buffer<ArrayBufferLike> = Buffer.alloc(0),
    final: Buffer<ArrayBufferLike> = Buffer.alloc(0),
    prompt = "",
    failures: string[] = [];
  let attempts = 0;
  for (attempts = 1; attempts <= 2; attempts++) {
    prompt = buildMaterialPrompt(
      description,
      enhanced,
      dna,
      failures.join("; ") || undefined,
    );
    diagnostics?.log("complete_outfit.ai_request", {
      generationId: diagnostics.generationId,
      elapsedMs: Date.now() - diagnostics.startedAt,
      currentStage: `${type}_generation`,
      openAIRequestType: "images.edit",
      attempt: attempts,
    });
    try {
      raw = await withAiTimeout(
        (signal) =>
          editImageBuffers(
            [
              { data: blank, filename: `blank-classic-${type}-585x559.png` },
              {
                data: guide,
                filename: `classic-${type}-region-guide-585x559.png`,
              },
              ...references,
            ],
            prompt,
            signal,
          ),
        timeoutMs("AI_IMAGE_TIMEOUT_MS", 120_000),
        `${type}_generation`,
      );
    } catch (error) {
      throw normalizeAiError(error, `${type}_generation`);
    }
    try {
      final = resizeToAtlas(raw);
      const composed = composeGarmentFingerprint(final, enhanced);
      final = composed.png;
      const inspection = inspectGarment(type, final, {
        garment: composed.fingerprint.key,
        appliedModules: composed.fingerprint.required,
      });
      failures = [
        ...validateClassicTexture(type, final, blank),
        ...validateGarmentFingerprint(enhanced, composed.fingerprint),
        ...inspection.failures,
      ];
    } catch (error) {
      failures = [
        error instanceof Error ? error.message : "image decoding failed",
      ];
    }
    if (!failures.length) break;
    diagnostics?.log("complete_outfit.validation_failed", {
      generationId: diagnostics.generationId,
      elapsedMs: Date.now() - diagnostics.startedAt,
      currentStage: `${type}_validation`,
      openAIRequestType: "images.edit",
      attempt: attempts,
      validationFailures: failures,
    });
  }
  if (failures.length)
    throw new AiGenerationError(
      "Image failed quality validation",
      "AI_VALIDATION",
      `${type}_validation`,
      true,
      502,
    );
  return {
    imageUrl: `data:image/png;base64,${final.toString("base64")}`,
    referenceUrl: `data:image/png;base64,${blank.toString("base64")}`,
    prompt,
    enhancedPrompt: formatEnhancedPrompt(enhanced),
    enhancedSpecification: enhanced,
    designMemory: {
      garmentKey: enhanced.designMemory.garmentKey,
      styles: enhanced.designMemory.styles.map((style) => style.key),
      learnedAdjustments: learned,
    },
    outfitDNA: dna,
    pipelineStages: [
      "intent",
      "fashion-planner",
      "material-generator",
      "garment-constructor",
      "quality-inspector",
    ],
    model: "gpt-image-1",
    requestMode: "images.edit",
    sourceSize: "1536x1024",
    finalSize: CLASSIC_TEXTURE_SIZE,
    attempts,
    qualityReferenceCount: references.length,
    sha256: createHash("sha256").update(final).digest("hex"),
  };
}
