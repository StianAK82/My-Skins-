import type { OutfitItem } from "./universal-outfit";

export type GeometryGroup = {
  name: string;
  dimensions: { width: number; height: number; depth: number };
  position?: { x: number; y: number; z: number };
  material: string;
  triangles: number;
};

export type ConstructionGeometry = {
  itemId: string;
  kind: string;
  parameters: Record<string, number | string | boolean>;
  groups: GeometryGroup[];
};

export type GeometryEvidence = {
  feature: string;
  required: number | string | boolean;
  measured: number | string | boolean | null;
  passed: boolean;
  meshGroup: string;
  method: string;
  screenshotView: "front" | "side" | "back";
};

export type GeometryVerification = {
  itemId: string;
  kind: string;
  passed: boolean;
  evidence: GeometryEvidence[];
  limitations: string[];
};

type Feature = {
  value: number | string | boolean;
  group: string;
  axis?: "width" | "height" | "depth";
  view?: "front" | "side" | "back";
};

const hoodie = (oversized = false, zip = false): Record<string, Feature> => ({
  hood_depth: {
    value: oversized ? 0.38 : 0.34,
    group: "hood",
    axis: "depth",
    view: "side",
  },
  hood_width: { value: oversized ? 0.58 : 0.52, group: "hood", axis: "width" },
  hood_height: {
    value: oversized ? 0.42 : 0.38,
    group: "hood",
    axis: "height",
  },
  hood_opening: { value: true, group: "hood_opening", view: "front" },
  hood_fold: { value: true, group: "hood_fold", view: "side" },
  shoulder_drop: {
    value: oversized ? 0.16 : 0.08,
    group: "shoulders",
    axis: "height",
  },
  sleeve_volume: { value: oversized ? "high" : "regular", group: "sleeves" },
  fabric_thickness: {
    value: oversized ? 0.04 : 0.035,
    group: "body_shell",
    axis: "depth",
    view: "side",
  },
  cuff_height: {
    value: oversized ? 0.1 : 0.09,
    group: "cuffs",
    axis: "height",
  },
  waistband_height: {
    value: oversized ? 0.13 : 0.12,
    group: "waistband",
    axis: "height",
  },
  oversized_amount: {
    value: oversized ? 0.22 : 0,
    group: "body_shell",
    axis: "width",
  },
  drawstrings: { value: true, group: "drawstrings" },
  ...(zip
    ? {
        zipper: { value: true, group: "zipper" },
        divided_front: { value: true, group: "front_left" },
      }
    : { kangaroo_pocket: { value: true, group: "kangaroo_pocket" } }),
});

export const GEOMETRY_PROFILES: Record<string, Record<string, Feature>> = {
  hoodie: hoodie(),
  oversized_hoodie: hoodie(true),
  zip_hoodie: hoodie(false, true),
  bomber_jacket: {
    rib_collar: { value: true, group: "rib_collar" },
    rib_cuffs: { value: true, group: "rib_cuffs" },
    rib_waistband: { value: true, group: "rib_waistband" },
    zipper: { value: true, group: "zipper" },
    cropped_body: { value: true, group: "cropped_body" },
    rounded_volume: { value: true, group: "body_shell", view: "side" },
  },
  blazer: {
    lapels: { value: true, group: "lapels" },
    structured_shoulders: { value: true, group: "shoulders" },
    front_opening: { value: true, group: "front_opening" },
    buttons: { value: true, group: "buttons" },
    formal_hem: { value: true, group: "formal_hem" },
  },
  puffer_jacket: {
    inflated_volume: { value: true, group: "inflated_shell", view: "side" },
    quilt_sections: { value: 6, group: "quilt_sections" },
    thick_sleeves: { value: true, group: "thick_sleeves" },
    heavy_body_shell: { value: true, group: "inflated_shell" },
  },
  cargo_pants: {
    side_pockets: { value: 2, group: "side_pockets" },
    waistband: { value: true, group: "waistband" },
    relaxed_fit: { value: true, group: "legs" },
    seam_placement: { value: true, group: "seams" },
    hem_treatment: { value: true, group: "hems" },
  },
  shoes: {
    paired_shoes: { value: 2, group: "shoes" },
    sole: { value: true, group: "soles" },
    upper: { value: true, group: "uppers" },
    toe_box: { value: true, group: "toe_boxes" },
    heel: { value: true, group: "heels", view: "back" },
    tongue: { value: true, group: "tongues" },
    laces: { value: true, group: "laces" },
  },
};
for (const kind of [
  "long_hair",
  "short_hair",
  "curly_hair",
  "afro_hair",
  "dreadlocks",
  "ponytail_hair",
  "anime_hair",
  "roblox_hair",
])
  GEOMETRY_PROFILES[kind] = {
    front_volume: { value: true, group: "hair_front" },
    side_volume: { value: true, group: "hair_sides", view: "side" },
    back_volume: { value: true, group: "hair_back", view: "back" },
    crown_clearance: { value: 0.03, group: "hair_crown", axis: "height" },
    ...(kind === "long_hair"
      ? {
          shoulder_clearance: {
            value: 0.02,
            group: "hair_back",
            axis: "width",
            view: "back",
          },
        }
      : {}),
  };

const dims = (feature: Feature) => ({
  width:
    feature.axis === "width" && typeof feature.value === "number"
      ? feature.value
      : 0.12,
  height:
    feature.axis === "height" && typeof feature.value === "number"
      ? feature.value
      : 0.12,
  depth:
    feature.axis === "depth" && typeof feature.value === "number"
      ? feature.value
      : 0.08,
});

/** Deterministic preview compiler: every canonical construction parameter owns a named mesh group. */
export function compileConstructionGeometry(
  item: Pick<OutfitItem, "id" | "kind" | "material">,
): ConstructionGeometry {
  const profile = GEOMETRY_PROFILES[item.kind] ?? {};
  const parameters = Object.fromEntries(
    Object.entries(profile).map(([key, f]) => [key, f.value]),
  );
  const groups: GeometryGroup[] = [
    ...new Set(Object.values(profile).map((f) => f.group)),
  ].flatMap((name) => {
    const entries = Object.entries(profile).filter(([, f]) => f.group === name);
    const count =
      typeof entries[0]?.[1].value === "number" &&
      ["side_pockets", "quilt_sections", "paired_shoes"].includes(entries[0][0])
        ? Number(entries[0][1].value)
        : 1;
    const dimensions = dims(entries[0][1]);
    for (const [, feature] of entries)
      if (feature.axis && typeof feature.value === "number")
        dimensions[feature.axis] = feature.value;
    return Array.from({ length: count }, (_, index) => ({
      name: count > 1 ? `${name}:${index + 1}` : name,
      dimensions: { ...dimensions },
      position:
        count === 2 ? { x: index ? 0.25 : -0.25, y: 0, z: 0 } : undefined,
      material: item.material,
      triangles: 48,
    }));
  });
  if (item.kind === "zip_hoodie")
    groups.push({
      name: "front_right",
      dimensions: { width: 0.24, height: 0.7, depth: 0.035 },
      material: item.material,
      triangles: 48,
    });
  return { itemId: item.id, kind: item.kind, parameters, groups };
}

export function verifyConstructionGeometry(
  item: Pick<OutfitItem, "id" | "kind" | "constructionDetails">,
  geometry: ConstructionGeometry,
): GeometryVerification {
  const profile = GEOMETRY_PROFILES[item.kind] ?? {};
  const metadata = new Set(
    item.constructionDetails.map((x) =>
      x.split(/[=:]/)[0].trim().replace(/[ -]/g, "_"),
    ),
  );
  const evidence = Object.entries(profile).map(
    ([feature, rule]): GeometryEvidence => {
      const matching = geometry.groups.filter(
        (g) => g.name === rule.group || g.name.startsWith(`${rule.group}:`),
      );
      let measured: GeometryEvidence["measured"] = matching.length
        ? (geometry.parameters[feature] ?? true)
        : null;
      if (["side_pockets", "quilt_sections", "paired_shoes"].includes(feature))
        measured = matching.length;
      if (rule.axis && matching[0] && typeof rule.value === "number")
        measured = matching[0].dimensions[rule.axis];
      const tolerance = typeof rule.value === "number" ? 0.015 : 0;
      const passed =
        metadata.has(feature) &&
        measured !== null &&
        (typeof rule.value !== "number" ||
          (typeof measured === "number" &&
            Math.abs(measured - rule.value) <= tolerance));
      return {
        feature,
        required: rule.value,
        measured,
        passed,
        meshGroup: rule.group,
        method: rule.axis
          ? `bounding_box.${rule.axis}`
          : "mesh_group_existence",
        screenshotView: rule.view ?? "front",
      };
    },
  );
  const limitations = evidence
    .filter((x) => !x.passed)
    .map((x) => `${x.feature} is not visible yet`);
  return {
    itemId: item.id,
    kind: item.kind,
    passed: evidence.every((x) => x.passed),
    evidence,
    limitations,
  };
}

export function repairConstructionGeometry(
  item: Pick<OutfitItem, "id" | "kind" | "material" | "constructionDetails">,
  geometry: ConstructionGeometry,
) {
  const before = verifyConstructionGeometry(item, geometry);
  const canonical = compileConstructionGeometry(item);
  const failed = new Set(
    before.evidence
      .filter(
        (e) =>
          !e.passed &&
          item.constructionDetails.some((d) => d.startsWith(e.feature)),
      )
      .map((e) => e.meshGroup),
  );
  const repaired = {
    ...geometry,
    parameters: { ...geometry.parameters },
    groups: [...geometry.groups],
  };
  for (const group of failed) {
    repaired.groups = repaired.groups.filter(
      (g) => g.name !== group && !g.name.startsWith(`${group}:`),
    );
    repaired.groups.push(
      ...canonical.groups.filter(
        (g) => g.name === group || g.name.startsWith(`${group}:`),
      ),
    );
    for (const [key, rule] of Object.entries(
      GEOMETRY_PROFILES[item.kind] ?? {},
    ))
      if (rule.group === group) repaired.parameters[key] = rule.value;
  }
  const after = verifyConstructionGeometry(item, repaired);
  return {
    itemId: item.id,
    before,
    after,
    geometry:
      after.evidence.filter((e) => e.passed).length >=
      before.evidence.filter((e) => e.passed).length
        ? repaired
        : geometry,
    accepted:
      after.evidence.filter((e) => e.passed).length >
      before.evidence.filter((e) => e.passed).length,
  };
}
