import test from "node:test";
import assert from "node:assert/strict";
import { routeAiIntent } from "./ai-intent-router.ts";

test("routeAiIntent maps creature/accessory/effect prompts into mixed intent", () => {
  const routed = routeAiIntent("my avatar should have wings and look like a dragon with glowing eyes", "Fantasy", "Dark flame");
  assert.equal(routed.primaryFocus, "mixed");
  assert.equal(routed.includesAvatarLook, true);
  assert.equal(routed.includesAccessories, true);
  assert.equal(routed.includesEffects, true);
  assert.equal(routed.fantasyArchetype, "dragon");
  assert.equal(routed.styleVibes.includes("dragon"), true);
  assert.equal(routed.styleVibes.includes("fantasy"), true);
});

test("routeAiIntent defaults unknown prompts to clothing focus", () => {
  const routed = routeAiIntent("clean black hoodie with blue flames");
  assert.equal(routed.primaryFocus, "mixed");
  assert.equal(routed.requestKinds.includes("clothing"), true);
});
