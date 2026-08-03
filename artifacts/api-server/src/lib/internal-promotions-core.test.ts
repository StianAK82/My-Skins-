import assert from "node:assert/strict";
import test from "node:test";
import {
  genericPromotionMessage,
  hashPromotionCode,
  isPromotionAdmin,
  normalizePromotionCode,
  resolvePromotionGrants,
} from "./internal-promotions-core";

test("promotion codes normalize case, whitespace and compatibility Unicode", () =>
  assert.equal(normalizePromotionCode("  free２d "), "FREE2D"));
test("promotion codes reject punctuation, confusable non-ascii and excess length", () => {
  for (const code of ["A B C", "FRЕE2D", "X".repeat(49)])
    assert.throws(() => normalizePromotionCode(code));
});
test("promotion hashing is keyed, stable and does not expose the code", () => {
  const hash = hashPromotionCode("FREE2D", "x".repeat(32));
  assert.equal(hash, hashPromotionCode("FREE2D", "x".repeat(32)));
  assert.equal(hash.length, 64);
  assert.ok(!hash.includes("FREE2D"));
});
test("selectable bundles resolve consistently to one mode", () =>
  assert.deepEqual(
    resolvePromotionGrants(
      [
        { family: "GENERATION", mode: "SELECTED", quantity: 1 },
        { family: "EXPORT", mode: "SELECTED", quantity: 1 },
      ],
      "THREE_D",
    ).map((g) => g.creditType),
    ["GENERATION_3D", "EXPORT_3D"],
  ));
test("selectable bundles require a mode", () =>
  assert.throws(
    () =>
      resolvePromotionGrants([
        { family: "GENERATION", mode: "SELECTED", quantity: 1 },
      ] as never),
    /PROMO_MODE_REQUIRED/,
  ));
test("customer error mapping does not disclose campaign state", () =>
  assert.equal(genericPromotionMessage(), "This code cannot be used."));
test("admin authorization is explicit allowlist only", () => {
  assert.equal(isPromotionAdmin("u1", "u1,u2"), true);
  assert.equal(isPromotionAdmin("u3", "u1,u2"), false);
});
