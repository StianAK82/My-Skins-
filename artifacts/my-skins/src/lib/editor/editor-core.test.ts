import test from "node:test";
import assert from "node:assert/strict";
import { parseDesignState, serializeDesignState } from "./persistence.ts";
import { useDesignStore } from "./design-state.ts";
import { getZonesForTemplate, snapLayerToZone } from "./templates.ts";
import { classicTextureAiSchema, parseClassicTextureAi } from "./ai-schema.ts";

const baseState = {
  version: 3 as const,
  template: "shirt" as const,
  activeTool: "templates" as const,
  activeZone: "front",
  selectedLayerId: null,
  paintSwatch: "#ffffff",
  preview: { split: true, mode: "split" as const, bodyType: "blocky" as const, view: "front" as const },
  aiPlanPreview: [],
  layers: [
    {
      id: "l1",
      name: "Base",
      type: "paintLayerSet" as const,
      zone: "front",
      color: "#ff0000",
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false },
    },
  ],
};

test("save/load preserves canonical design state", () => {
  const serialized = serializeDesignState(baseState);
  const parsed = parseDesignState(serialized);
  assert.deepEqual(parsed, baseState);
});

test("v2 persistence migration upgrades version and defaults aiPlanPreview", () => {
  const v2 = JSON.stringify({
    ...baseState,
    version: 2,
    aiPlanPreview: undefined,
  });

  const migrated = parseDesignState(v2);
  assert.equal(migrated.version, 3);
  assert.deepEqual(migrated.aiPlanPreview, []);
});

test("save/load rejects malformed design payload", () => {
  const malformed = JSON.stringify({ ...baseState, version: 999 });
  assert.throws(() => parseDesignState(malformed));
});

test("layer ordering is deterministic through reorder operations", () => {
  const store = useDesignStore.getState();
  store.loadSnapshot({ ...baseState, layers: [] });
  store.addLayer({ name: "A", type: "paintLayerSet", zone: "front", color: "#000000" });
  store.addLayer({ name: "B", type: "paintLayerSet", zone: "front", color: "#111111" });
  store.addLayer({ name: "C", type: "paintLayerSet", zone: "front", color: "#222222" });

  const second = useDesignStore.getState().state.layers[1]?.id;
  assert.ok(second);
  useDesignStore.getState().reorderLayer(second, "up");

  const names = useDesignStore.getState().state.layers.map((layer) => layer.name);
  assert.deepEqual(names, ["A", "C", "B"]);
});

test("reorder at boundaries is deterministic no-op", () => {
  const store = useDesignStore.getState();
  store.loadSnapshot({
    ...baseState,
    layers: [
      { id: "a", name: "A", type: "paintLayerSet", zone: "front", color: "#111111", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
      { id: "b", name: "B", type: "paintLayerSet", zone: "front", color: "#222222", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
    ],
  });

  store.reorderLayer("a", "down");
  store.reorderLayer("b", "up");
  assert.deepEqual(useDesignStore.getState().state.layers.map((layer) => layer.id), ["a", "b"]);
});

test("template zones stay bounded with snap behavior", () => {
  const zone = getZonesForTemplate("shirt").find((entry) => entry.key === "front");
  assert.ok(zone);
  const snapped = snapLayerToZone({ x: zone.left - 20, y: zone.top + zone.height + 20, zone });
  assert.equal(snapped.x, zone.left);
  assert.equal(snapped.y, zone.top + zone.height);
});

test("template zone snap keeps in-bounds coordinates unchanged", () => {
  const zone = getZonesForTemplate("pants").find((entry) => entry.key === "left_leg_front");
  assert.ok(zone);
  const snapped = snapLayerToZone({ x: zone.left + 15, y: zone.top + 15, zone });
  assert.equal(snapped.x, zone.left + 15);
  assert.equal(snapped.y, zone.top + 15);
});

test("AI schema rejects invalid payload and accepts strict structured plan", () => {
  assert.throws(() => classicTextureAiSchema.parse({ model: "ClassicTextureAI.v2", garmentType: "shirt", palette: ["#xyz"], style: "Neo", zones: {}, layers: [] }));

  const valid = classicTextureAiSchema.parse({
    model: "ClassicTextureAI.v2",
    garmentType: "shirt",
    style: "Neo",
    palette: ["#111111", "#22d3ee"],
    zones: { front: "main focus" },
    layers: [
      { name: "Main", type: "moduleLayer", zone: "front", assetId: "module_pocket", color: "#22d3ee", transform: { scale: 1.2 } },
    ],
  });

  const parsedLayers = parseClassicTextureAi(valid);
  assert.equal(parsedLayers[0]?.type, "moduleLayer");
  assert.equal(parsedLayers[0]?.transform.scale, 1.2);
});

test("AI schema enforces garment zone validity and required content by layer type", () => {
  assert.throws(() => classicTextureAiSchema.parse({
    model: "ClassicTextureAI.v2",
    garmentType: "pants",
    style: "Utility",
    palette: ["#111111", "#22d3ee"],
    zones: { left_leg_front: "focus" },
    layers: [{ name: "Chest", type: "moduleLayer", zone: "waist_panel", transform: { scale: 1 } }],
  }));

  assert.throws(() => classicTextureAiSchema.parse({
    model: "ClassicTextureAI.v2",
    garmentType: "shirt",
    style: "Neo",
    palette: ["#111111", "#22d3ee"],
    zones: { front: "focus" },
    layers: [{ name: "Headline", type: "textLayer", zone: "front", transform: { scale: 1 } }],
  }));

  assert.throws(() => classicTextureAiSchema.parse({
    model: "ClassicTextureAI.v2",
    garmentType: "shirt",
    style: "Neo",
    palette: ["#111111", "#22d3ee"],
    zones: { front: "focus" },
    layers: [{ name: "Invalid allover", type: "moduleLayer", zone: "front", placementIntent: "allover", assetCategory: "module", assetId: "module_pocket" }],
  }));
});

test("AI parser applies structured placement anchor and bounds layer transform", () => {
  const parsedLayers = parseClassicTextureAi({
    model: "ClassicTextureAI.v2",
    garmentType: "pants",
    style: "Neo",
    palette: ["#111111", "#22d3ee"],
    zones: { left_leg_front: "focus", right_leg_front: "support" },
    layers: [
      { name: "Leg stripe", type: "moduleLayer", zone: "left_leg_front", assetId: "module_side_stripe", anchor: "top_left", relativeScale: 0.4, transform: { x: -999, y: -999, rotation: 280 } },
    ],
  });

  assert.equal(parsedLayers.length, 1);
  assert.equal(parsedLayers[0]?.transform.x, -64);
  assert.equal(parsedLayers[0]?.transform.y, -96);
  assert.equal(parsedLayers[0]?.transform.scale, 0.4);
  assert.equal(parsedLayers[0]?.transform.rotation, 280);
});

test("AI apply flow is deterministic: preview cleared and appended order preserved", () => {
  const store = useDesignStore.getState();
  store.loadSnapshot({
    ...baseState,
    layers: [
      { id: "existing", name: "Existing", type: "paintLayerSet", zone: "front", color: "#000000", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
    ],
    aiPlanPreview: [],
  });

  const aiLayers = parseClassicTextureAi({
    model: "ClassicTextureAI.v2",
    garmentType: "shirt",
    style: "Neo",
    palette: ["#111111", "#22d3ee"],
    zones: { front: "main focus" },
    layers: [
      { name: "Main", type: "moduleLayer", zone: "front", assetId: "module_pocket", color: "#22d3ee", transform: { scale: 1.2 } },
      { name: "Label", type: "textLayer", zone: "front", text: "MY SKINS", color: "#111111" },
    ],
  });
  store.setAiPlanPreview(aiLayers);
  store.applyAiPlan();

  const state = useDesignStore.getState().state;
  assert.deepEqual(state.layers.map((layer) => layer.name), ["Existing", "Main", "Label"]);
  assert.equal(state.aiPlanPreview.length, 0);
  assert.ok(state.selectedLayerId?.startsWith("layer_"));
});


test("store defaults improve flow: template zone and new layer selection", () => {
  const store = useDesignStore.getState();
  store.loadSnapshot({ ...baseState, template: "shirt", activeZone: "front", layers: [], selectedLayerId: null });

  store.setTemplate("pants");
  assert.equal(useDesignStore.getState().state.activeZone, "left_leg_front");

  store.addLayer({ name: "New Layer", type: "paintLayerSet", zone: "left_leg_front", color: "#333333" });
  const latest = useDesignStore.getState().state.layers.at(-1);
  assert.equal(useDesignStore.getState().state.selectedLayerId, latest?.id ?? null);
});
