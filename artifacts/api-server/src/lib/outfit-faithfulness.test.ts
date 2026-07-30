import assert from "node:assert/strict";
import test from "node:test";
import type { OutfitForFaithfulness } from "./outfit-faithfulness";
import { evaluateOutfitFaithfulness } from "./outfit-faithfulness";

function outfit(patch: Partial<OutfitForFaithfulness>): OutfitForFaithfulness {
  return {
    top: "none",
    bottom: "none",
    shoes: "none",
    hair: { style: "none", color: "#111111" },
    accessories: [],
    unsupported: [],
    reason: "test",
    ...patch,
  };
}

const cases: Array<[string, OutfitForFaithfulness]> = [
  ["White hoodie", outfit({ top: "hoodie" })],
  [
    "Long black hair and a red cap",
    outfit({
      hair: { style: "long", color: "#111111" },
      accessories: [{ kind: "cap", color: "#FF0000", size: "medium" }],
    }),
  ],
  [
    "White jacket, blue jeans and black shoes",
    outfit({ top: "jacket", bottom: "pants", shoes: "sneakers" }),
  ],
  [
    "Backpack and large white angel wings",
    outfit({
      accessories: [
        { kind: "backpack", color: "#333333", size: "medium" },
        { kind: "wings", color: "#FFFFFF", size: "large" },
      ],
    }),
  ],
  [
    "Pink dress, crown and silver shoes",
    outfit({
      top: "dress",
      shoes: "sneakers",
      accessories: [{ kind: "crown", color: "#F5C542", size: "medium" }],
    }),
  ],
  [
    "Black ninja outfit with mask, belt and boots",
    outfit({
      top: "sweater",
      bottom: "pants",
      shoes: "boots",
      accessories: [
        { kind: "mask", color: "#111111", size: "medium" },
        { kind: "belt", color: "#111111", size: "medium" },
      ],
    }),
  ],
  [
    "Football kit with shirt, shorts, socks and shoes",
    outfit({
      top: "tshirt",
      bottom: "shorts",
      shoes: "sneakers",
      unsupported: ["socks"],
    }),
  ],
  [
    "Winter coat, wool hat, shoulder bag and boots",
    outfit({
      top: "jacket",
      shoes: "boots",
      accessories: [
        { kind: "beanie", color: "#444444", size: "medium" },
        { kind: "bag", color: "#555555", size: "medium" },
      ],
    }),
  ],
  [
    "Lag en blå hettegenser, svart caps, ryggsekk og hvite sko",
    outfit({
      top: "hoodie",
      shoes: "sneakers",
      accessories: [
        { kind: "cap", color: "#111111", size: "medium" },
        { kind: "backpack", color: "#333333", size: "medium" },
      ],
    }),
  ],
];

for (const [prompt, result] of cases) {
  test(`accepts a faithful plan: ${prompt}`, () => {
    assert.deepEqual(evaluateOutfitFaithfulness(prompt, result).issues, []);
  });
}

test("reports every missing requested item for a Norwegian multi-item prompt", () => {
  const report = evaluateOutfitFaithfulness(
    "Lag en blå hettegenser, svart caps, ryggsekk og hvite sko",
    outfit({ top: "sweater" }),
  );
  assert.equal(report.ok, false);
  assert.deepEqual(report.requirements, ["hoodie", "shoes", "cap", "backpack"]);
  assert.equal(report.issues.length, 4);
});

test("does not require unrelated pieces for a single hoodie", () => {
  const report = evaluateOutfitFaithfulness(
    "White hoodie",
    outfit({ top: "hoodie" }),
  );
  assert.deepEqual(report.requirements, ["hoodie"]);
});
