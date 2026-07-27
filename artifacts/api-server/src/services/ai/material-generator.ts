import type { EnhancedGarmentSpecification } from "./classic-prompt-enhancer.ts";
import type { OutfitDNA } from "./outfit-dna.ts";
/** Stage 3's strict surface-only contract. Construction is deliberately excluded. */
export function buildMaterialPrompt(
  description: string,
  spec: EnhancedGarmentSpecification,
  dna: OutfitDNA,
  correction?: string,
): string {
  const artwork = [
    ...spec.decorativeDetails,
    ...(spec.visibleText ? [`exact text ${spec.visibleText}`] : []),
  ];
  return [
    "Generate a seamless, flat garment MATERIAL MAP on the supplied Roblox Classic UV islands. This is surface texture input for a procedural constructor, not a garment.",
    `Material: ${dna.fabric.weave}; base ${dna.palette.primary}; shadow tone ${dna.palette.shadows}; seam-blend tone ${dna.palette.seams}; roughness ${dna.materialRoughness}; weave scale ${dna.fabric.textureScale}.`,
    `Surface only: believable fibre/weave, ${dna.foldIntensity} intensity gravity wrinkles, subtle ${dna.lighting.direction} tonal shading, micro-stitch texture, and physically restrained edge variation. Apply one consistent scale and light direction to every island.`,
    artwork.length
      ? `Requested surface artwork only: ${artwork.join(", ")}. Prints must follow weave and wrinkles.`
      : "No graphics, logos, symbols, letters, or numbers.",
    /dirty|worn|distress/i.test(description)
      ? "Add only the explicitly requested localized wear or dirt."
      : "Clean new fabric: no dirt, distressing, stains, or random wear.",
    "ABSOLUTE RULE: do not draw or invent any hood, opening, pocket, drawstring, cuff, collar, button, zipper, waistband, fly, seam layout, hem, garment edge, body, mannequin, scene, label, guide, or construction. The deterministic renderer adds all construction later.",
    "Fill every supplied valid UV island completely; outside islands stays transparent. Return exactly one flat 585x559 transparent PNG, with no explanation.",
    correction
      ? `Previous surface failed inspection. Correct only the material: ${correction}. Do not change design or invent construction.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
