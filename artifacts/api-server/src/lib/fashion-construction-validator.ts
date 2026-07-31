export type ConstructionCheck = {
  requirement: string;
  passed: boolean;
  evidence: string | null;
};

export type ItemConstructionReport = {
  itemId: string;
  kind: string;
  score: number;
  checks: ConstructionCheck[];
};

export type FashionConstructionReport = {
  score: number;
  passed: boolean;
  items: ItemConstructionReport[];
  reasons: string[];
};

/** Construction features guaranteed by each supported preview primitive. */
export const CONSTRUCTION_PROFILES: Readonly<
  Record<string, readonly string[]>
> = {
  hoodie: [
    "hood_depth=0.34",
    "hood_width=0.52",
    "hood_height=0.38",
    "cuff_height=0.09",
    "waistband_height=0.12",
    "fabric_thickness=0.035",
    "sleeve_volume=regular",
    "kangaroo_pocket",
    "drawstrings",
    "hood_fold",
    "hood_opening",
    "shoulder_drop=0.08",
    "oversized_amount=0.00",
  ],
  oversized_hoodie: [
    "hood_depth=0.38",
    "hood_width=0.58",
    "hood_height=0.42",
    "cuff_height=0.10",
    "waistband_height=0.13",
    "fabric_thickness=0.04",
    "sleeve_volume=high",
    "kangaroo_pocket",
    "drawstrings",
    "hood_fold",
    "hood_opening",
    "shoulder_drop=0.16",
    "oversized_amount=0.22",
  ],
  zip_hoodie: [
    "hood_depth=0.34",
    "hood_width=0.52",
    "hood_height=0.38",
    "cuff_height=0.09",
    "waistband_height=0.12",
    "fabric_thickness=0.035",
    "sleeve_volume=regular",
    "drawstrings",
    "hood_fold",
    "hood_opening",
    "shoulder_drop=0.08",
    "oversized_amount=0.00",
    "zipper",
  ],
  bomber_jacket: [
    "rib_collar",
    "rib_cuffs",
    "rib_waistband",
    "zipper",
    "cropped_body",
    "rounded_volume",
  ],
  blazer: [
    "lapels",
    "structured_shoulders",
    "front_opening",
    "buttons",
    "formal_hem",
  ],
  suit_jacket: ["lapels", "structured_shoulders", "front_opening", "buttons"],
  puffer_jacket: [
    "quilt_sections",
    "inflated_volume",
    "thick_sleeves",
    "heavy_body_shell",
  ],
  winter_coat: ["quilt_sections", "inflated_volume", "thick_sleeves"],
  cargo_pants: [
    "side_pockets",
    "waistband",
    "relaxed_fit",
    "seam_placement",
    "hem_treatment",
  ],
  shoes: [
    "paired_shoes",
    "sole",
    "upper",
    "heel",
    "toe_box",
    "tongue",
    "laces",
  ],
  long_hair: [
    "front_volume",
    "side_volume",
    "back_volume",
    "crown_clearance",
    "shoulder_clearance",
  ],
  short_hair: ["front_volume", "side_volume", "back_volume", "crown_clearance"],
  curly_hair: ["front_volume", "side_volume", "back_volume", "crown_clearance"],
  afro_hair: ["front_volume", "side_volume", "back_volume", "crown_clearance"],
  dreadlocks: ["front_volume", "side_volume", "back_volume", "crown_clearance"],
  ponytail_hair: [
    "front_volume",
    "side_volume",
    "back_volume",
    "crown_clearance",
  ],
  anime_hair: ["front_volume", "side_volume", "back_volume", "crown_clearance"],
  roblox_hair: [
    "front_volume",
    "side_volume",
    "back_volume",
    "crown_clearance",
  ],
};

const keyOf = (detail: string) =>
  detail.trim().toLowerCase().replace(/[ -]+/g, "_").split(/[=:]/, 1)[0];

export function constructionDetailsFor(kind: string): string[] {
  return [...(CONSTRUCTION_PROFILES[kind] ?? [])];
}

export function validateFashionConstruction(
  items: Array<{
    id: string;
    kind: string;
    constructionDetails: string[];
    unsupported?: { state: boolean };
  }>,
  threshold = 95,
): FashionConstructionReport {
  const reports = items
    .filter(
      (item) => !item.unsupported?.state && CONSTRUCTION_PROFILES[item.kind],
    )
    .map((item) => {
      const evidence = new Map(
        item.constructionDetails.map((detail) => [keyOf(detail), detail]),
      );
      const checks = CONSTRUCTION_PROFILES[item.kind].map((required) => ({
        requirement: keyOf(required),
        passed: evidence.has(keyOf(required)),
        evidence: evidence.get(keyOf(required)) ?? null,
      }));
      return {
        itemId: item.id,
        kind: item.kind,
        score: Math.round(
          (100 * checks.filter((check) => check.passed).length) / checks.length,
        ),
        checks,
      };
    });
  const score = reports.length
    ? Math.round(
        reports.reduce((sum, report) => sum + report.score, 0) / reports.length,
      )
    : 100;
  const reasons = reports.flatMap((report) =>
    report.checks
      .filter((check) => !check.passed)
      .map((check) => `${report.kind}: missing ${check.requirement}`),
  );
  return {
    score,
    passed: score >= threshold && reasons.length === 0,
    items: reports,
    reasons,
  };
}
