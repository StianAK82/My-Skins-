import assert from "node:assert/strict";
import test from "node:test";
import {
  GARMENT_KEYS,
  GARMENT_LIBRARY,
} from "../services/ai/garment-library.ts";
import { buildMaterialPrompt } from "../services/ai/material-generator.ts";
import {
  planOutfitDNA,
  understandFashionIntent,
} from "../services/ai/outfit-dna.ts";
import { enhanceGarmentPrompt } from "../services/ai/classic-prompt-enhancer.ts";
import { inspectGarment } from "../services/ai/quality-inspector.ts";
import { encodeRgba } from "../services/ai/classic-atlas.ts";

test("white hoodie produces stable professional intent and Outfit DNA", () => {
  const intent = understandFashionIntent("White hoodie skin");
  assert.deepEqual(intent, {
    style: "streetwear",
    garment: "hoodie",
    material: "heavy cotton fleece",
    fit: "regular",
    colours: ["white"],
    mood: "clean",
    ageGroup: "kids",
    realism: "roblox",
  });
  const a = planOutfitDNA(intent, "outfit-1"),
    b = planOutfitDNA(intent, "outfit-1");
  assert.deepEqual(a, b);
  assert.equal(a.palette.primary, "#FFFFFF");
  assert.equal(a.fabric.weave, "heavy cotton fleece");
});
test("library gives every supported garment invariant construction", () => {
  assert.equal(GARMENT_KEYS.length, 8);
  for (const key of GARMENT_KEYS) {
    const item = GARMENT_LIBRARY[key];
    assert.ok(item.requiredModules.length >= 5, key);
    assert.ok(Object.keys(item.uvAnchors).length >= 4, key);
    assert.ok(item.constructionRules.length >= 2, key);
  }
  assert.deepEqual(GARMENT_LIBRARY.hoodie.requiredModules, [
    "hood",
    "hood-opening",
    "drawstrings",
    "kangaroo-pocket",
    "shoulder-seams",
    "sleeve-seams",
    "rib-cuffs",
    "rib-hem",
  ]);
});
test("material prompt forbids model-created garment construction", () => {
  const intent = understandFashionIntent("white hoodie"),
    dna = planOutfitDNA(intent, "x"),
    spec = enhanceGarmentPrompt("shirt", "white hoodie");
  const prompt = buildMaterialPrompt("white hoodie", spec, dna);
  assert.match(prompt, /do not draw or invent any hood/i);
  assert.match(prompt, /surface texture input/i);
  assert.doesNotMatch(prompt, /Generate a hoodie/i);
});
test("inspector rejects missing required modules and accepts complete textured atlas", () => {
  const rgba = Buffer.alloc(585 * 559 * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 210 + (i % 17);
    rgba[i + 1] = 205 + (i % 13);
    rgba[i + 2] = 200 + (i % 11);
    rgba[i + 3] = 255;
  }
  const png = encodeRgba(585, 559, rgba),
    template = GARMENT_LIBRARY.hoodie;
  const failed = inspectGarment("shirt", png, {
    garment: "hoodie",
    appliedModules: ["hood"],
  });
  assert.equal(failed.passed, false);
  assert.match(failed.failures.join(" "), /drawstrings/);
  const passed = inspectGarment("shirt", png, {
    garment: "hoodie",
    appliedModules: template.requiredModules,
  });
  assert.equal(passed.passed, true);
  assert.equal(passed.checks.atlasCompleteness, true);
});
