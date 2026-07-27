import assert from "node:assert/strict";
import test from "node:test";
import { enhanceGarmentPrompt, formatEnhancedPrompt } from "../services/ai/classic-prompt-enhancer.ts";

test("semantic classification produces a panel-aware garment blueprint", () => {
  const blueprint = enhanceGarmentPrompt("shirt", "comfortable premium black sweater with a red dragon", {
    garmentType: "oversized hoodie",
    material: "heavyweight cotton",
    fit: "oversized",
    primaryColours: ["black"],
    accentColours: ["red"],
    artwork: ["red dragon on front"],
    explicitDetails: [],
  });

  assert.equal(blueprint.garmentType, "oversized hoodie");
  assert.equal(blueprint.material, "heavyweight cotton");
  assert.equal(blueprint.fit, "oversized");
  assert.deepEqual(blueprint.colourProfile, { primary: ["black"], accent: ["red"] });
  assert.ok(blueprint.front.some((detail) => detail.includes("kangaroo pocket")));
  assert.ok(blueprint.back.some((detail) => detail.includes("hood")));
  assert.ok(blueprint.sleeves.some((detail) => detail.includes("sleeves")));
  assert.deepEqual(blueprint.decorativeDetails, ["dragon", "red dragon on front"]);

  const prompt = formatEnhancedPrompt(blueprint);
  assert.match(prompt, /GARMENT: oversized hoodie; FIT: oversized/);
  assert.match(prompt, /FRONT:/);
  assert.match(prompt, /BACK:/);
  assert.match(prompt, /SLEEVES:/);
});

test("keyword planning remains available without a model classification", () => {
  const blueprint = enhanceGarmentPrompt("pants", "vintage washed denim jeans");
  assert.equal(blueprint.garmentType, "jeans");
  assert.equal(blueprint.material, "denim");
  assert.ok(blueprint.legs.length > 0);
});
