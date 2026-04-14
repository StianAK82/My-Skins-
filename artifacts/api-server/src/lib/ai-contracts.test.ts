import test from "node:test";
import assert from "node:assert/strict";
import { aiDesignResponseSchema, aiGenerateRequestSchema, aiImproveRequestSchema, aiDesignSchema, validatePlacementForItemType } from "./ai-contracts.ts";

const base = {
  title: "Neon Drift",
  itemType: "classic_shirt",
  style: "Cyberpunk",
  styleIdentity: "cyber_streetwear",
  target: "roblox",
  theme: "neon racing",
  colorPalette: ["#111111", "#00AEEF", "#EEEEEE"],
  paletteRoles: {
    primary: "#111111",
    secondary: "#00AEEF",
    accent: "#EEEEEE",
    neutral: "#1F2937",
    contrastPair: ["#111111", "#EEEEEE"],
    contrastLevel: "high",
  },
  designElements: ["stripes", "trim", "glyph logo"],
  placement: {
    front: "bold center stripe",
    back: "small logo-free panel",
    leftSleeve: "thin cyan strip",
    rightSleeve: "thin cyan strip",
    leftLeg: "not_used",
    rightLeg: "not_used",
  },
  modules: [
    { id: "hero", type: "graphic", label: "Hero", color: "#EEEEEE", position: { x: 0.5, y: 0.35 }, scale: 1.02, rotation: 0, opacity: 1, layer: 0 },
    { id: "trim", type: "trim", label: "Trim", color: "#00AEEF", position: { x: 0.5, y: 0.55 }, scale: 0.7, rotation: 0, opacity: 0.95, layer: 1 },
    { id: "stripe", type: "stripe", label: "Stripe", color: "#111111", position: { x: 0.2, y: 0.5 }, scale: 0.5, rotation: 8, opacity: 0.9, layer: 2 },
    { id: "symbol", type: "chest_symbol", label: "Symbol", color: "#00AEEF", position: { x: 0.5, y: 0.2 }, scale: 0.65, rotation: 0, opacity: 0.95, layer: 3 },
  ],
  outfitComposition: {
    silhouette: "balanced",
    vibe: "bold",
    garmentFocus: "trim_work",
    trimIntent: "Connect all seams with neon trim",
    patternDensity: "light",
    accessoryDensity: "medium",
  },
  avatarCoordination: {
    faceMood: "confident",
    hairMood: "edgy",
    auraIntent: "energy",
    accessoryIntent: ["hat", "neck"],
    cohesionNotes: ["Use matching cyan metal accents", "Keep face expression assertive"],
  },
  qualitySignals: {
    distinctiveness: 8,
    paletteScore: 8,
    coherenceScore: 8,
    robloxReadability: 9,
  },
  editorInstructions: {
    baseTemplate: "classic_shirt_default",
    recommendedPreset: "cyberpunk",
    notes: ["keep readable at distance"],
  },
};

test("aiDesignSchema parses valid structured design", () => {
  const parsed = aiDesignSchema.parse(base);
  assert.equal(parsed.itemType, "classic_shirt");
  assert.equal(parsed.styleIdentity, "cyber_streetwear");
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
    avatarCoordination: { ...base.avatarCoordination, accessoryIntent: ["footwear", "back"] },
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

test("aiGenerateRequestSchema accepts classic shirt success payload", () => {
  const parsed = aiGenerateRequestSchema.parse({
    prompt: "clean esports shirt with neon trims",
    itemType: "classic_shirt",
    style: "Sport",
    theme: "Neon",
  });

  assert.equal(parsed.itemType, "classic_shirt");
  assert.equal(parsed.prompt.includes("shirt"), true);
});

test("aiGenerateRequestSchema accepts classic pants success payload", () => {
  const parsed = aiGenerateRequestSchema.parse({
    prompt: "black tactical pants with reflective side stripes",
    itemType: "classic_pants",
    style: "Tactical",
  });

  assert.equal(parsed.itemType, "classic_pants");
  assert.equal(parsed.prompt.includes("pants"), true);
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
