import assert from "node:assert/strict";
import test from "node:test";
import { GOLDEN_PROMPTS } from "./golden-prompts.ts";

test("golden suite has at least 50 unique structured bilingual cases", () => {
  assert.ok(GOLDEN_PROMPTS.length >= 50);
  assert.equal(
    new Set(GOLDEN_PROMPTS.map((entry) => entry.id)).size,
    GOLDEN_PROMPTS.length,
  );
  assert.deepEqual(
    new Set(GOLDEN_PROMPTS.map((entry) => entry.language)),
    new Set(["en", "no"]),
  );
});
test("golden suite covers simple, composite, revision, unsupported and adversarial behavior", () =>
  assert.deepEqual(
    new Set(GOLDEN_PROMPTS.map((entry) => entry.kind)),
    new Set(["simple", "composite", "revision", "unsupported", "adversarial"]),
  ));
test("mandatory golden prompts remain permanent", () => {
  for (const prompt of [
    "White hoodie",
    "Oversized black zip hoodie",
    "Gjør bare vingene større",
    "Rosa prinsessekjole med krone og sko",
    "Blå hettegenser, caps, ryggsekk og hvite sko",
  ])
    assert.ok(
      GOLDEN_PROMPTS.some((entry) => entry.prompt === prompt),
      prompt,
    );
});
