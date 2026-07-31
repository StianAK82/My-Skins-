import assert from "node:assert/strict";
import test from "node:test";
import {
  constructionDetailsFor,
  validateFashionConstruction,
} from "./fashion-construction-validator";

test("hoodie profile validates every quantitative and structural requirement", () => {
  const report = validateFashionConstruction([
    {
      id: "top-hoodie-01",
      kind: "hoodie",
      constructionDetails: constructionDetailsFor("hoodie"),
    },
  ]);
  assert.equal(report.score, 100);
  assert.equal(report.passed, true);
  assert.equal(report.items[0].checks.length, 13);
  assert.ok(report.items[0].checks.every((check) => check.passed));
});

test("validator reports a precise construction deficit instead of accepting the garment label", () => {
  const details = constructionDetailsFor("hoodie").filter(
    (detail) => detail !== "hood_fold",
  );
  const report = validateFashionConstruction([
    { id: "top-hoodie-01", kind: "hoodie", constructionDetails: details },
  ]);
  assert.equal(report.passed, false);
  assert.equal(report.items[0].score, 92);
  assert.deepEqual(report.reasons, ["hoodie: missing hood_fold"]);
});

test("core fashion categories have complete construction profiles", () => {
  for (const kind of [
    "bomber_jacket",
    "blazer",
    "puffer_jacket",
    "cargo_pants",
    "shoes",
    "long_hair",
  ]) {
    const report = validateFashionConstruction([
      {
        id: `item-${kind}`,
        kind,
        constructionDetails: constructionDetailsFor(kind),
      },
    ]);
    assert.equal(report.score, 100, kind);
  }
});
