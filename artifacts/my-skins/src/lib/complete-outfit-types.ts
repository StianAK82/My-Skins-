export type PreviewProductContract = {
  exportType: "roblox-classic";
  previewRepresentation: "geometry-assisted";
  hasReal3DExport: false;
};

export const PREVIEW_PRODUCT_CONTRACT: PreviewProductContract = {
  exportType: "roblox-classic",
  previewRepresentation: "geometry-assisted",
  hasReal3DExport: false,
};

export type CompleteOutfitResponse = {
  preview: { shirtTexture: string; pantsTexture: string };
  outfitBlueprint: { theme: string; completeLook: string; top: { type: string }; bottom: { type: string }; footwear: { type: string } };
  components: { shirtTexture: string; pantsTexture: string; footwearPreview: { support: string }; accessories: unknown[] };
  export: { robloxItemCount: number } & Partial<PreviewProductContract>;
};
