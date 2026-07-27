import type { GarmentFit } from "./garment-manifest.ts";
export type FitGeometry = { bodyOffset: number; width: number; sleeveWidth: number; shoulderDrop: number; lengthScale: number; foldIntensity: number; rigidity: number };
export const GARMENT_FITS: Record<GarmentFit, FitGeometry> = {
  slim: { bodyOffset: .035, width: .96, sleeveWidth: .9, shoulderDrop: 0, lengthScale: .98, foldIntensity: .15, rigidity: .35 },
  regular: { bodyOffset: .055, width: 1, sleeveWidth: 1, shoulderDrop: 0, lengthScale: 1, foldIntensity: .3, rigidity: .4 },
  relaxed: { bodyOffset: .075, width: 1.07, sleeveWidth: 1.1, shoulderDrop: .04, lengthScale: 1.03, foldIntensity: .5, rigidity: .3 },
  oversized: { bodyOffset: .1, width: 1.18, sleeveWidth: 1.22, shoulderDrop: .1, lengthScale: 1.12, foldIntensity: .7, rigidity: .2 },
  athletic: { bodyOffset: .05, width: 1.03, sleeveWidth: .96, shoulderDrop: 0, lengthScale: .98, foldIntensity: .2, rigidity: .5 },
  loose: { bodyOffset: .09, width: 1.13, sleeveWidth: 1.16, shoulderDrop: .07, lengthScale: 1.08, foldIntensity: .62, rigidity: .2 },
  structured: { bodyOffset: .08, width: 1.06, sleeveWidth: 1.03, shoulderDrop: 0, lengthScale: 1.04, foldIntensity: .08, rigidity: .9 },
};
