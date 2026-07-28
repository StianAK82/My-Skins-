import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDesignPayload } from "./ai-normalize.ts";
import { aiOutfitSchema } from "./ai-contracts.ts";
import { z } from "zod";

type Outfit = z.infer<typeof aiOutfitSchema>;

const previousOutfit: Outfit = {
  top: "hoodie",
  bottom: "pants",
  shoes: "sneakers",
  hair: { style: "ponytail", color: "#AA3355" },
  accessories: [
    { kind: "cap", color: "#112233" },
    { kind: "wings", color: "#FFFFFF" },
    { kind: "backpack", color: "#00FF00" },
  ],
  unsupported: [],
  reason: "",
};

const revisionInput = {
  prompt: "gjør capsen blå",
  itemType: "classic_shirt" as const,
  previousOutfit,
};

function outfitOf(payload: unknown): Outfit {
  const result = (payload as { outfit: unknown }).outfit;
  return aiOutfitSchema.parse(result);
}

test("revision mode: completely missing outfit keeps every previous value", () => {
  const outfit = outfitOf(normalizeDesignPayload(revisionInput, { title: "x" }));
  assert.deepEqual(outfit, previousOutfit);
});

test("revision mode: empty payload object keeps every previous value", () => {
  const outfit = outfitOf(normalizeDesignPayload(revisionInput, {}));
  assert.deepEqual(outfit, previousOutfit);
});

test("revision mode: invalid top/bottom/shoes fall back to previous values", () => {
  const outfit = outfitOf(normalizeDesignPayload(revisionInput, {
    outfit: { top: "spacesuit", bottom: 42, shoes: null },
  }));
  assert.equal(outfit.top, "hoodie");
  assert.equal(outfit.bottom, "pants");
  assert.equal(outfit.shoes, "sneakers");
});

test("revision mode: missing hair keeps previous style and color", () => {
  const outfit = outfitOf(normalizeDesignPayload(revisionInput, {
    outfit: { top: "hoodie", bottom: "pants", shoes: "sneakers" },
  }));
  assert.deepEqual(outfit.hair, { style: "ponytail", color: "#AA3355" });
});

test("revision mode: invalid hair style/color falls back per-field to previous hair", () => {
  const outfit = outfitOf(normalizeDesignPayload(revisionInput, {
    outfit: { hair: { style: "mohawk", color: "blueish" } },
  }));
  assert.deepEqual(outfit.hair, { style: "ponytail", color: "#AA3355" });
});

test("revision mode: omitted accessories list falls back to previous list", () => {
  const outfit = outfitOf(normalizeDesignPayload(revisionInput, {
    outfit: { top: "hoodie", bottom: "pants", shoes: "sneakers", hair: { style: "ponytail", color: "#AA3355" } },
  }));
  assert.deepEqual(outfit.accessories, previousOutfit.accessories);
});

test("revision mode: valid changed field is applied while missing fields keep previous values", () => {
  const outfit = outfitOf(normalizeDesignPayload(revisionInput, {
    outfit: {
      accessories: [
        { kind: "cap", color: "#0000FF" },
        { kind: "wings", color: "#FFFFFF" },
        { kind: "backpack", color: "#00FF00" },
      ],
    },
  }));
  // cap recolored per the change request
  assert.deepEqual(outfit.accessories[0], { kind: "cap", color: "#0000FF" });
  // wings/backpack untouched, garments preserved from previousOutfit
  assert.deepEqual(outfit.accessories.slice(1), previousOutfit.accessories.slice(1));
  assert.equal(outfit.top, "hoodie");
  assert.equal(outfit.bottom, "pants");
  assert.equal(outfit.shoes, "sneakers");
});

test("revision mode: explicitly provided empty accessories array is respected (removal)", () => {
  const outfit = outfitOf(normalizeDesignPayload(revisionInput, {
    outfit: { accessories: [] },
  }));
  assert.deepEqual(outfit.accessories, []);
});

test("without previousOutfit, missing fields use defaults (no crash)", () => {
  const outfit = outfitOf(normalizeDesignPayload(
    { prompt: "en genser", itemType: "classic_shirt" },
    {},
  ));
  assert.equal(outfit.top, "sweater");
  assert.equal(outfit.bottom, "pants");
  assert.equal(outfit.shoes, "none");
  assert.equal(outfit.hair.style, "none");
  assert.deepEqual(outfit.accessories, []);
});
