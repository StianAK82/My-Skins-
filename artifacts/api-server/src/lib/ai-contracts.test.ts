import test from "node:test";
import assert from "node:assert/strict";
import { aiDesignSchema, validatePlacementForItemType } from "./ai-contracts";

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
