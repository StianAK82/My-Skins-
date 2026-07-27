import test from "node:test";
import assert from "node:assert/strict";
import { planOutfitBlueprint } from "../services/ai/outfit-blueprint.ts";

for (const prompt of ["lag et hvitt skin", "lag en hvit hettegenser", "svart skin med blå flammer", "pink anime outfit", "football skin with number 10"]) {
  test(`plans a complete bilingual outfit: ${prompt}`, () => {
    const plan = planOutfitBlueprint(prompt);
    assert.ok(plan.top.type && plan.bottom.type && plan.footwear.type);
    assert.match(plan.completeLook, /outfit/);
  });
}
test("a hoodie receives coordinated trousers", () => assert.equal(planOutfitBlueprint("white hoodie").bottom.colour, "white"));
test("trousers receive a coordinated top", () => assert.equal(planOutfitBlueprint("blue trousers").top.type, "coordinated sweatshirt"));
test("fallback planning is always fully dressed", () => {
  const plan = planOutfitBlueprint("skin");
  assert.deepEqual([plan.top.colour, plan.bottom.colour, plan.footwear.colour], ["blue", "blue", "white"]);
});
