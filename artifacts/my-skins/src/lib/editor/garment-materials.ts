import type { GarmentMaterial } from "./garment-manifest.ts";
export type GarmentMaterialProfile = { roughness: number; normalStrength: number; weaveScale: number; softness: number; metallic: number; foldResponse: number; edgeContrast: number; seamContrast: number };
export const GARMENT_MATERIALS: Record<GarmentMaterial, GarmentMaterialProfile> = {
  "cotton-jersey": { roughness:.72, normalStrength:.25, weaveScale:.7, softness:.7, metallic:0, foldResponse:.65, edgeContrast:.2, seamContrast:.35 },
  "cotton-fleece": { roughness:.92, normalStrength:.3, weaveScale:.5, softness:.9, metallic:0, foldResponse:.8, edgeContrast:.15, seamContrast:.25 },
  denim: { roughness:.62, normalStrength:.55, weaveScale:.35, softness:.3, metallic:0, foldResponse:.38, edgeContrast:.75, seamContrast:.8 },
  canvas: { roughness:.78, normalStrength:.5, weaveScale:.45, softness:.3, metallic:0, foldResponse:.35, edgeContrast:.55, seamContrast:.7 },
  "performance-mesh": { roughness:.42, normalStrength:.35, weaveScale:.2, softness:.6, metallic:0, foldResponse:.55, edgeContrast:.25, seamContrast:.4 },
  wool: { roughness:.86, normalStrength:.38, weaveScale:.55, softness:.72, metallic:0, foldResponse:.55, edgeContrast:.35, seamContrast:.45 },
  "leather-like": { roughness:.3, normalStrength:.28, weaveScale:1, softness:.2, metallic:.05, foldResponse:.2, edgeContrast:.7, seamContrast:.8 },
  "satin-like": { roughness:.18, normalStrength:.12, weaveScale:.25, softness:.78, metallic:.05, foldResponse:.75, edgeContrast:.4, seamContrast:.25 },
  armour: { roughness:.24, normalStrength:.15, weaveScale:1, softness:0, metallic:.82, foldResponse:0, edgeContrast:.9, seamContrast:.75 },
  knitted: { roughness:.88, normalStrength:.7, weaveScale:.8, softness:.86, metallic:0, foldResponse:.8, edgeContrast:.2, seamContrast:.3 },
};
