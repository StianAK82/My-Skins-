import test from "node:test";
import assert from "node:assert/strict";
import { useDesignStore } from "./design-state.ts";

test("applyAiPlan applies clothing layers + avatar preview and resets AI preview state", () => {
  useDesignStore.setState((s) => ({
    ...s,
    state: {
      ...s.state,
      layers: [],
      aiPlanPreview: [{
        id: "ai_layer_1",
        name: "Dragon chest sigil",
        type: "moduleLayer",
        zone: "front",
        assetId: "module-dragon",
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false },
      }],
      aiAvatarPreview: { slots: { back: { assetId: "back_blade_rig", scale: 1, visible: true, offset: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } } },
      aiResultSummary: { exportable: ["Classic shirt texture"], previewOnly: ["hero back: back_blade_rig"], appliedTargets: ["Applied to shirt/pants layers", "Applied to avatar look preview"] },
    },
  }));

  useDesignStore.getState().applyAiPlan();
  const next = useDesignStore.getState().state;

  assert.equal(next.layers.length, 1);
  assert.equal(next.avatar.slots.back?.assetId, "back_blade_rig");
  assert.equal(next.aiPlanPreview.length, 0);
  assert.equal(next.aiAvatarPreview, null);
  assert.equal(next.aiResultSummary, null);
});
