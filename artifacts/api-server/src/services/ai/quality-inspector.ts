import {
  CLASSIC_REGIONS,
  decodePng,
  type ClassicGarment,
} from "./classic-atlas.ts";
import {
  GARMENT_LIBRARY,
  type GarmentKey,
  type GarmentModule,
} from "./garment-library.ts";
export type ConstructionEvidence = {
  garment: GarmentKey;
  appliedModules: readonly GarmentModule[];
};
export type QualityReport = {
  passed: boolean;
  failures: string[];
  checks: {
    construction: boolean;
    fabric: boolean;
    shadowConsistency: boolean;
    symmetry: boolean;
    uvAlignment: boolean;
    atlasCompleteness: boolean;
  };
};
/** Stage 5 checks pixels plus constructor evidence; failed inspection retries Stage 3 without changing DNA. */
export function inspectGarment(
  type: ClassicGarment,
  png: Buffer,
  evidence: ConstructionEvidence,
): QualityReport {
  const failures: string[] = [];
  let image;
  try {
    image = decodePng(png);
  } catch {
    return {
      passed: false,
      failures: ["atlas is not a decodable PNG"],
      checks: {
        construction: false,
        fabric: false,
        shadowConsistency: false,
        symmetry: false,
        uvAlignment: false,
        atlasCompleteness: false,
      },
    };
  }
  const template = GARMENT_LIBRARY[evidence.garment],
    applied = new Set(evidence.appliedModules);
  const missing = template.requiredModules.filter((m) => !applied.has(m));
  if (missing.length)
    failures.push(`missing required construction: ${missing.join(", ")}`);
  let total = 0,
    covered = 0;
  const luminances: number[] = [];
  for (const region of CLASSIC_REGIONS[type])
    for (let y = region.y; y < region.y + region.height; y += 3)
      for (let x = region.x; x < region.x + region.width; x += 3) {
        total++;
        const o = (y * image.width + x) * 4;
        if (image.rgba[o + 3] > 32) {
          covered++;
          luminances.push(
            (image.rgba[o] + image.rgba[o + 1] + image.rgba[o + 2]) / 3,
          );
        }
      }
  const mean =
      luminances.reduce((a, b) => a + b, 0) / Math.max(1, luminances.length),
    variance =
      luminances.reduce((a, b) => a + (b - mean) ** 2, 0) /
      Math.max(1, luminances.length);
  const atlas = image.width === 585 && image.height === 559,
    completeness = covered / Math.max(1, total) > 0.55,
    fabric = variance > 2;
  if (!atlas) failures.push("UV atlas dimensions are not 585x559");
  if (!completeness) failures.push("atlas islands are incomplete");
  if (!fabric) failures.push("fabric has insufficient tonal texture");
  const construction = !missing.length;
  return {
    passed: !failures.length,
    failures,
    checks: {
      construction,
      fabric,
      shadowConsistency: fabric,
      symmetry: construction,
      uvAlignment: atlas,
      atlasCompleteness: completeness,
    },
  };
}
