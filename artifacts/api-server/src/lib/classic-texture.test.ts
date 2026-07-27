import assert from "node:assert/strict";
import test from "node:test";

process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ??= "http://localhost.invalid";
process.env.AI_INTEGRATIONS_OPENAI_API_KEY ??= "test-key";
const { enhanceGarmentPrompt, formatEnhancedPrompt } = await import("../services/ai/classic-prompt-enhancer.ts");

test("enhancement preserves requested material, construction, graphic and no invented text", () => {
  const spec = enhanceGarmentPrompt("shirt", "White hoodie with blue dragon");
  assert.equal(spec.material, "woven clothing fabric");
  assert.deepEqual(spec.primaryColours, ["white", "blue"]);
  assert.ok(spec.constructionDetails.includes("hood"));
  assert.ok(spec.constructionDetails.includes("structured hood"));
  assert.ok(spec.decorativeDetails.includes("dragon"));
  assert.equal(spec.visibleText, null);
  assert.match(formatEnhancedPrompt(spec), /No visible text/);
});


test("exact requested text and location are preserved", () => {
  const spec = enhanceGarmentPrompt("shirt", "Red football jersey with number 10 on the back");
  assert.equal(spec.visibleText, '"10" on the back');
  assert.ok(spec.realismInstructions.includes("lightweight synthetic texture"));
});

test("material-specific denim realism is added", () => {
  const spec = enhanceGarmentPrompt("pants", "Blue denim jeans with waistband and pockets");
  assert.equal(spec.material, "denim");
  assert.ok(spec.realismInstructions.includes("visible denim grain"));
  assert.ok(spec.constructionDetails.includes("waistband"));
});
