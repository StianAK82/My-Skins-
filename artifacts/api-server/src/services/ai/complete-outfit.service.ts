import { generateClassicTexture } from "./classic-texture.service";
import { planOutfitBlueprint } from "./outfit-blueprint";

export async function generateCompleteOutfit(description: string) {
  const outfitBlueprint = planOutfitBlueprint(description);
  const sharedDirection = `${description}. Complete coordinated ${outfitBlueprint.completeLook}; palette ${[...outfitBlueprint.primaryColours, ...outfitBlueprint.accentColours].join(", ")}.`;
  const [shirt, pants] = await Promise.all([
    generateClassicTexture("shirt", `${sharedDirection} Top: ${outfitBlueprint.top.type}, ${outfitBlueprint.top.details?.join(", ")}.`),
    generateClassicTexture("pants", `${sharedDirection} Bottom: ${outfitBlueprint.bottom.type}, ${outfitBlueprint.bottom.details?.join(", ")}.`),
  ]);
  return {
    preview: { shirtTexture: shirt.imageUrl, pantsTexture: pants.imageUrl, view: "front" },
    outfitBlueprint,
    components: {
      shirtTexture: shirt.imageUrl,
      pantsTexture: pants.imageUrl,
      footwearPreview: { ...outfitBlueprint.footwear, support: "downloadable preview only" },
      accessories: outfitBlueprint.accessories.map((name) => ({ name, support: "planned for future 3D support" })),
    },
    export: { robloxItemCount: 2, supportedItems: ["shirt", "pants"], previewOnlyItems: ["footwear", ...outfitBlueprint.accessories] },
  };
}
