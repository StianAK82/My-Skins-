export const HOODIE_VISIBILITY_THRESHOLDS = {
  hoodSilhouette: .82, hoodOpening: .75, drawstrings: .72, pocket: .78, cuffs: .8,
  lowerHem: .8, shoulderConnection: .9, bodyContinuity: .92, symmetry: .9, intersectionSafety: .9,
} as const;

export type HoodieVisibilityScores = Record<keyof typeof HOODIE_VISIBILITY_THRESHOLDS, number> & { passed: boolean };

/** Scores deterministic projection masks used by the controlled front/back renderer. */
export function inspectHoodieProjection(visible: Partial<Record<keyof typeof HOODIE_VISIBILITY_THRESHOLDS, number>>): HoodieVisibilityScores {
  const scores = Object.fromEntries(Object.keys(HOODIE_VISIBILITY_THRESHOLDS).map((key) => [key, Math.max(0, Math.min(1, visible[key as keyof typeof visible] ?? 0))])) as Omit<HoodieVisibilityScores, "passed">;
  return { ...scores, passed: Object.entries(HOODIE_VISIBILITY_THRESHOLDS).every(([key, threshold]) => scores[key as keyof typeof scores] >= threshold) };
}

export const WHITE_HOODIE_BASELINE = inspectHoodieProjection({
  hoodSilhouette: .94, hoodOpening: .91, drawstrings: .93, pocket: .9, cuffs: .94,
  lowerHem: .95, shoulderConnection: .97, bodyContinuity: .98, symmetry: .99, intersectionSafety: .96,
});
