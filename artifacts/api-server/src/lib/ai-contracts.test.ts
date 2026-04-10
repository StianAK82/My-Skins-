import test from "node:test";
import assert from "node:assert/strict";
import { aiDesignResponseSchema, aiGenerateRequestSchema, aiImproveRequestSchema, aiDesignSchema, validatePlacementForItemType } from "./ai-contracts.ts";

const base = {
  title: "Neon Drift",
  itemType: "classic_shirt",
  style: "Cyberpunk",
  target: "roblox",
  theme: "neon racing",
  colorPalette: ["#111111", "#00AEEF", "#EEEEEE"],
  designElements: ["stripes", "trim"],
  placement: {
    front: "bold center stripe",
    back: "small logo-free panel",
    leftSleeve: "thin cyan strip",
    rightSleeve: "thin cyan strip",
    leftLeg: "not_used",
    rightLeg: "not_used",
  },
  modules: [],
  editorInstructions: {
    baseTemplate: "classic_shirt_default",
    recommendedPreset: "cyberpunk",
    notes: ["keep readable at distance"],
  },
};

test("aiDesignSchema parses valid structured design", () => {
  const parsed = aiDesignSchema.parse(base);
  assert.equal(parsed.itemType, "classic_shirt");
});

test("placement validation rejects shirt with active legs", () => {
  const payload = aiDesignSchema.parse({
    ...base,
    placement: { ...base.placement, leftLeg: "graphic", rightLeg: "graphic" },
  });
  assert.equal(validatePlacementForItemType(payload), false);
});

test("placement validation accepts pants with disabled sleeves", () => {
  const payload = aiDesignSchema.parse({
    ...base,
    itemType: "classic_pants",
    placement: {
      front: "knee stripe",
      back: "rear stripe",
      leftSleeve: "not_used",
      rightSleeve: "not_used",
      leftLeg: "bold left leg stripe",
      rightLeg: "bold right leg stripe",
    },
  });

  assert.equal(validatePlacementForItemType(payload), true);
});

test("aiGenerateRequestSchema rejects unsupported 3d item types", () => {
  assert.throws(() => aiGenerateRequestSchema.parse({
    prompt: "futuristic hoodie concept",
    itemType: "layered_3d_hoodie",
  }));
});

test("aiGenerateRequestSchema requires canonical request shape", () => {
  assert.throws(() => aiGenerateRequestSchema.parse({
    prompt: "clean esports pants",
    itemType: "classic_pants",
    extra: "not-allowed",
  }));
});

test("aiDesignResponseSchema parses canonical completed payload", () => {
  const parsed = aiDesignResponseSchema.parse({
    meta: { generationId: "gen-1", status: "completed", warnings: [] },
    result: base,
  });
  assert.equal(parsed.meta.status, "completed");
  assert.equal(parsed.result.itemType, "classic_shirt");
});

test("aiImproveRequestSchema requires complete canonical design payload", () => {
  assert.throws(() => aiImproveRequestSchema.parse({
    instruction: "add more contrast",
    design: { title: "invalid-design-only-title" },
  }));
});

test("aiDesignSchema rejects invalid module enums and invalid hex", () => {
  assert.throws(() => aiDesignSchema.parse({
    ...base,
    modules: [{
      id: "mod-1",
      type: "logo",
      label: "Invalid module type",
      color: "#XYZXYZ",
      position: { x: 0.5, y: 0.5 },
      scale: 1,
      rotation: 0,
      opacity: 1,
      layer: 1,
    }],
  }));
});
