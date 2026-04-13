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

test("template zones stay bounded with snap behavior", () => {
  const zone = getZonesForTemplate("shirt").find((entry) => entry.key === "front");
  assert.ok(zone);
  const snapped = snapLayerToZone({ x: zone.left - 20, y: zone.top + zone.height + 20, zone });
  assert.equal(snapped.x, zone.left);
  assert.equal(snapped.y, zone.top + zone.height);
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
      { name: "Main", type: "moduleLayer", zone: "front", color: "#22d3ee", transform: { scale: 1.2 } },
    ],
  });

  const parsedLayers = parseClassicTextureAi(valid);
  assert.equal(parsedLayers[0]?.type, "moduleLayer");
  assert.equal(parsedLayers[0]?.transform.scale, 1.2);
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
