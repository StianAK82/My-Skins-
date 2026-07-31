import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRevision,
  ASSET_REGISTRY,
  routeAsset,
  scoreOutfitQuality,
  universalOutfitSpecSchema,
  legacyToUniversalOutfitSpec,
  toPreviewSceneSpec,
  type UniversalOutfitSpec,
} from "./universal-outfit.ts";

const dimensions = Object.fromEntries(
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
  ].map((key) => [key, 90]),
) as UniversalOutfitSpec["quality"]["dimensions"];
const item = (id: string, category: "top" | "accessory", kind: string) => ({
  id,
  category,
  kind,
  label: kind,
  colors: ["#000000"],
  fit: "regular" as const,
  silhouette: "distinct",
  material: "cotton",
  constructionDetails: [],
  decorativeDetails: [],
  size: "medium" as const,
  placement: category === "top" ? "torso" : "back",
  layeringOrder: 1,
  relationships: [],
  previewCapability: "supported" as const,
  exportCapability:
    category === "top" ? ("classic_shirt" as const) : ("none" as const),
  fallback: { state: "none" as const, message: null },
  unsupported: { state: false, reason: null },
});
const fixture = (): UniversalOutfitSpec =>
  universalOutfitSpecSchema.parse({
    schemaVersion: "1.0",
    generationId: "00000000-0000-4000-8000-000000000001",
    promptLanguage: "no",
    normalizedUserIntent: "black hoodie and wings",
    styleDirection: "streetwear",
    colorPalette: ["#000000"],
    items: [
      item("top-main", "top", "hoodie"),
      item("accessory-wings-01", "accessory", "wings"),
    ],
    onePieceBehavior: "not_applicable",
    safetyState: "approved",
    rightsState: "pending",
    moderationState: "pending",
    revisionHistory: [],
    validationEvidence: [],
    quality: scoreOutfitQuality(dimensions),
    repairHistory: [],
  });

test("canonical schema rejects duplicate stable IDs", () =>
  assert.throws(() =>
    universalOutfitSpecSchema.parse({
      ...fixture(),
      items: [
        item("top-main", "top", "hoodie"),
        item("top-main", "top", "tshirt"),
      ],
    }),
  ));
test("quality score is bounded, explained and fails closed on critical preview failure", () => {
  const result = scoreOutfitQuality({ ...dimensions, previewStability: 0 });
  assert.equal(result.score, 84);
  assert.equal(result.accepted, false);
  assert.equal(Object.keys(result.dimensions).length, 15);
});
test("asset router resolves exact garments and never silently substitutes hoodie", () => {
  assert.equal(
    routeAsset({
      kind: "cargo_pants",
      category: "bottom",
      fit: "regular",
      size: "large",
    }).state,
    "resolved",
  );
  const missing = routeAsset({
    kind: "spacesuit",
    category: "top",
    fit: "regular",
    size: "medium",
  });
  assert.deepEqual(
    { state: missing.state, manifest: missing.manifest },
    { state: "unsupported", manifest: null },
  );
  assert.match(missing.reason!, /spacesuit/);
});
test("registry declares truthful preview, export, rights, limits, version and tests", () => {
  assert.ok(ASSET_REGISTRY.length >= 25);
  for (const entry of ASSET_REGISTRY) {
    assert.ok(entry.previewImplementation);
    assert.equal(entry.production3d, null);
    assert.ok(
      entry.license &&
        entry.version &&
        entry.tests.length &&
        entry.limitations.length,
    );
  }
});
test("revision changes only the targeted stable item field and stores no raw instruction", () => {
  const before = fixture();
  const after = applyRevision(
    before,
    "Gjør bare vingene større",
    { itemId: "accessory-wings-01", field: "size", value: "large" },
    new Date("2026-07-30T00:00:00Z"),
  );
  assert.equal(after.items[1].size, "large");
  assert.deepEqual(after.items[0], before.items[0]);
  assert.equal(after.revisionHistory[0].instructionHash.length, 64);
  assert.equal(JSON.stringify(after).includes("Gjør bare"), false);
  assert.deepEqual(after.revisionHistory[0].changedPaths, [
    "items.accessory-wings-01.size",
  ]);
});
test("one-piece and supported separate garments cannot coexist", () => {
  const onePiece = {
    ...item("one-piece-main", "top", "dress"),
    category: "one_piece",
    id: "one-piece-main",
  };
  assert.throws(
    () =>
      universalOutfitSpecSchema.parse({
        ...fixture(),
        items: [onePiece, item("bottom-main", "top", "jeans")],
      }),
    /one-piece replaces/,
  );
});

test("legacy model output crosses one deprecated boundary into the canonical routed pipeline", () => {
  const spec = legacyToUniversalOutfitSpec({
    generationId: "00000000-0000-4000-8000-000000000002", prompt: "Black zip hoodie and jeans", style: "streetwear", palette: ["#000000", "#202020"],
    outfit: { top: "hoodie", bottom: "pants", shoes: "none", hair: { style: "none", color: "#000000" }, accessories: [], unsupported: [], reason: "requested" },
  });
  assert.deepEqual(universalOutfitSpecSchema.parse(spec), spec);
  assert.equal(new Set(spec.items.map(i => i.id)).size, spec.items.length);
  assert.ok(spec.validationEvidence.some(e => e.validator === "asset-router" && e.passed));
  assert.equal(spec.quality.accepted, true);
  const scene = toPreviewSceneSpec(spec);
  assert.equal(scene.items.length, 2);
  assert.deepEqual(scene.items.map(i => i.kind), ["hoodie", "joggers"]);
});

test("model items become UniversalOutfitSpec directly without legacy shape", async () => {
  const { modelItemsToUniversalOutfitSpec } = await import("./universal-outfit"); const spec = modelItemsToUniversalOutfitSpec({ generationId: "00000000-0000-4000-8000-000000000003", prompt: "White hoodie", style: "clean", palette: ["#FFFFFF"], items: [{ id: "top-hoodie-01", category: "top", kind: "hoodie", label: "White hoodie", color: "#FFFFFF", fit: "regular", size: "medium", material: "cotton", placement: "torso" }], faithfulness: { score: 100, issues: [] }, repairHistory: [{ attempt: 1, changedPaths: ["items"], previousScore: 50, resultingScore: 100 }] }); assert.equal(spec.quality.accepted, true); assert.equal(spec.repairHistory.length, 1);
});
