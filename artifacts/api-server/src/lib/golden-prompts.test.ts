import assert from "node:assert/strict";
import test from "node:test";
import { GOLDEN_PROMPTS } from "./golden-prompts.ts";

test("golden suite has at least 50 unique structured bilingual cases", () => {
  assert.ok(GOLDEN_PROMPTS.length >= 50);
  assert.equal(
    new Set(GOLDEN_PROMPTS.map((entry) => entry.id)).size,
    GOLDEN_PROMPTS.length,
  );
  assert.deepEqual(
    new Set(GOLDEN_PROMPTS.map((entry) => entry.language)),
    new Set(["en", "no"]),
  );
});
test("golden suite covers simple, composite, revision, unsupported and adversarial behavior", () =>
  assert.deepEqual(
    new Set(GOLDEN_PROMPTS.map((entry) => entry.kind)),
    new Set(["simple", "composite", "revision", "unsupported", "adversarial"]),
  ));
test("mandatory golden prompts remain permanent", () => {
  for (const prompt of [
    "White hoodie",
    "Oversized black zip hoodie",
    "Gjør bare vingene større",
    "Rosa prinsessekjole med krone og sko",
    "Blå hettegenser, caps, ryggsekk og hvite sko",
  ])
    assert.ok(
      GOLDEN_PROMPTS.some((entry) => entry.prompt === prompt),
      prompt,
    );
});


import {
  routeAsset,
  scoreOutfitQuality,
  toPreviewSceneSpec,
  universalOutfitSpecSchema,
  type OutfitItem,
  type QualityDimensions,
} from "./universal-outfit.ts";

const categoryFor = (kind: string): OutfitItem["category"] =>
  [
    "hoodie",
    "zip_hoodie",
    "tshirt",
    "jacket",
    "varsity_jacket",
    "winter_coat",
    "football_jersey",
    "formal_shirt",
    "suit_jacket",
  ].includes(kind)
    ? "top"
    : ["jeans", "joggers", "cargo_pants", "formal_trousers", "shorts"].includes(
          kind,
        )
      ? "bottom"
      : kind === "dress"
        ? "one_piece"
        : ["shoes", "boots"].includes(kind)
          ? "footwear"
          : kind.includes("hair")
            ? "hair"
            : "accessory";
const colorFor = (prompt: string) =>
  (
    ({
      white: "#FFFFFF",
      black: "#000000",
      blue: "#2563EB",
      red: "#DC2626",
      pink: "#EC4899",
      green: "#16A34A",
      yellow: "#FACC15",
      brown: "#92400E",
      grey: "#6B7280",
      orange: "#F97316",
      purple: "#9333EA",
      silver: "#C0C0C0",
      golden: "#D4AF37",
      hvit: "#FFFFFF",
      svart: "#000000",
      blå: "#2563EB",
      rosa: "#EC4899",
      grønn: "#16A34A",
      rødt: "#DC2626",
      gull: "#D4AF37",
    }) as Record<string, string>
  )[
    Object.keys({
      white: 1,
      black: 1,
      blue: 1,
      red: 1,
      pink: 1,
      green: 1,
      yellow: 1,
      brown: 1,
      grey: 1,
      orange: 1,
      purple: 1,
      silver: 1,
      golden: 1,
      hvit: 1,
      svart: 1,
      blå: 1,
      rosa: 1,
      grønn: 1,
      rødt: 1,
      gull: 1,
    }).find((key) => prompt.toLowerCase().includes(key)) ?? ""
  ] ?? "#808080";
const dimensions = (score = 94) =>
  Object.fromEntries(
    [
      "promptFaithfulness",
      "itemCompleteness",
      "colorCorrectness",
      "silhouetteQuality",
      "proportionQuality",
      "layeringQuality",
      "materialCoherence",
      "constructionDetail",
      "styleCoherence",
      "accessoryPlacement",
      "collisionRisk",
      "previewStability",
      "exportValidity",
      "childAppeal",
      "revisionPreservation",
    ].map((key) => [key, score]),
  ) as QualityDimensions;

function generationFixture(entry: (typeof GOLDEN_PROMPTS)[number]) {
  const modifiers = new Set([
    "white",
    "black",
    "blue",
    "red",
    "pink",
    "green",
    "yellow",
    "brown",
    "grey",
    "orange",
    "purple",
    "silver",
    "golden",
    "oversized",
  ]);
  const requested = entry.expected.filter(
    (value) =>
      !modifiers.has(value) &&
      !value.includes("=") &&
      !value.includes(":remove") &&
      !value.startsWith("safety:") &&
      !value.startsWith("rights:"),
  );
  const items = requested.map((expectation, index) => {
    const [kind, modifier] = expectation.split(":");
    const unsupported = modifier === "unsupported";
    const category = categoryFor(kind);
    const routed = unsupported
      ? {
          state: "unsupported" as const,
          reason: `Explicitly unsupported: ${kind}`,
        }
      : routeAsset({
          kind,
          category,
          fit: "regular",
          size:
            modifier === "large" || modifier === "small" ? modifier : "medium",
        });
    const supported = routed.state === "resolved";
    return {
      id: `${category === "one_piece" ? "one-piece" : category}-${kind.replaceAll("_", "-")}-${String(index + 1).padStart(2, "0")}`,
      category,
      kind,
      label: kind,
      colors: [colorFor(entry.prompt)],
      fit: "regular" as const,
      silhouette: kind,
      material: "fixture",
      constructionDetails: [],
      decorativeDetails: [],
      size:
        modifier === "large" || modifier === "small"
          ? modifier
          : ("medium" as const),
      placement: category,
      layeringOrder: index,
      relationships: [],
      previewCapability: supported
        ? ("supported" as const)
        : ("unsupported" as const),
      exportCapability:
        supported && category === "top"
          ? ("classic_shirt" as const)
          : supported && category === "bottom"
            ? ("classic_pants" as const)
            : ("none" as const),
      fallback: {
        state: supported ? ("none" as const) : ("unavailable" as const),
        message: supported ? null : routed.reason,
      },
      unsupported: {
        state: !supported,
        reason: supported ? null : routed.reason,
      },
    };
  });
  const failures = items
    .filter((item) => item.unsupported.state)
    .map((item) => item.unsupported.reason!);
  const quality = scoreOutfitQuality(
    dimensions(failures.length ? 70 : 94),
    failures,
  );
  return universalOutfitSpecSchema.parse({
    schemaVersion: "1.0",
    generationId: `00000000-0000-4000-8000-${entry.id.slice(-2).padStart(12, "0")}`,
    promptLanguage: entry.language,
    normalizedUserIntent: entry.prompt,
    styleDirection: "golden fixture",
    colorPalette: [colorFor(entry.prompt)],
    items,
    onePieceBehavior: items.some((item) => item.category === "one_piece")
      ? "replaces_top_and_bottom"
      : "not_applicable",
    safetyState: "approved",
    rightsState: "approved",
    moderationState: "approved",
    revisionHistory: [],
    validationEvidence: [
      {
        validator: "golden-faithfulness",
        passed: failures.length === 0,
        reasons: failures,
      },
    ],
    quality,
    repairHistory: [],
  });
}

test("all non-adversarial generation goldens traverse schema, quality, AssetRouter and preview", () => {
  for (const entry of GOLDEN_PROMPTS.filter(
    (entry) => !["revision", "adversarial"].includes(entry.kind),
  )) {
    const spec = generationFixture(entry);
    assert.equal(
      new Set(spec.items.map((item) => item.id)).size,
      spec.items.length,
      entry.id,
    );
    const unsupported = entry.kind === "unsupported";
    assert.equal(spec.quality.accepted, !unsupported, entry.id);
    for (const item of spec.items) {
      if (item.unsupported.state)
        assert.equal(item.previewCapability, "unsupported", entry.id);
      else
        assert.equal(
          routeAsset(item).state,
          "resolved",
          `${entry.id}:${item.kind}`,
        );
    }
    const scene = toPreviewSceneSpec(spec);
    assert.equal(
      scene.items.length,
      spec.items.filter((item) => !item.unsupported.state).length,
      entry.id,
    );
  }
});
