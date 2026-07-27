import assert from "node:assert/strict";
import test from "node:test";
import {
  learnedInstructions,
  retrieveDesignMemory,
  type DesignFeedback,
} from "../services/ai/design-memory.ts";

test("design memory retrieves garment practices and composable style traits", () => {
  const memory = retrieveDesignMemory(
    "shirt",
    "Black oversized streetwear hoodie, modern minimal and premium",
  );
  assert.equal(memory.garmentKey, "oversized-hoodie");
  assert.ok(
    memory.garmentPractices.some((rule) => rule.includes("kangaroo pocket")),
  );
  assert.deepEqual(
    memory.styles.map((style) => style.key),
    ["streetwear", "oversized", "modern-minimal", "luxury"],
  );
});

test("learning waits for a useful sample and promotes recurring quality issues", () => {
  const smallSample: DesignFeedback[] = Array.from({ length: 9 }, () => ({
    issues: ["insufficient_texture"],
    accepted: false,
  }));
  assert.deepEqual(learnedInstructions(smallSample), []);

  const matureSample: DesignFeedback[] = [
    ...Array.from(
      { length: 7 },
      (): DesignFeedback => ({
        issues: ["insufficient_texture"],
        accepted: false,
      }),
    ),
    ...Array.from(
      { length: 3 },
      (): DesignFeedback => ({
        issues: ["front_copied_to_back"],
        accepted: false,
      }),
    ),
  ];
  const learned = learnedInstructions(matureSample);
  assert.equal(learned.length, 2);
  assert.ok(learned.some((rule) => rule.includes("texture strength")));
  assert.ok(
    learned.some((rule) => rule.includes("front/back differentiation")),
  );
});
