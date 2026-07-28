import assert from "node:assert/strict";
import test from "node:test";
import { generatedGarmentSpecSchema } from "./generated-outfit-contracts.ts";
import { assessGenerationSafety } from "../services/ai/generation-safety.ts";

test("generation safety blocks harmful child-facing prompts and transforms protected IP", () => {
  assert.equal(assessGenerationSafety("make a nude skin").decision, "block");
  assert.equal(assessGenerationSafety("Nike football shirt").decision, "transform");
  assert.equal(assessGenerationSafety("Lag en hvit hettegenser").decision, "allow");
});

test("discriminated garment schema rejects hoodie geometry on a t-shirt", () => {
  const invalid = { category:"t-shirt", hood:{enabled:true} };
  assert.equal(generatedGarmentSpecSchema.safeParse(invalid).success, false);
});
