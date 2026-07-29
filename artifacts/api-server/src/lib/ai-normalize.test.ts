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
  customParts: [],
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

test("customParts: valid headcover part is kept as-is", () => {
  const outfit = outfitOf(normalizeDesignPayload(
    { prompt: "marshmallow-hode", itemType: "classic_shirt" },
    { outfit: { customParts: [{ name: "Marshmallow head", shape: "headcover", attach: "face", color: "#FFF7EE", size: "large" }] } },
  ));
  assert.deepEqual(outfit.customParts, [
    { name: "Marshmallow head", shape: "headcover", attach: "face", color: "#FFF7EE", size: "large" },
  ]);
});

test("customParts: mixed-language names are preserved and trimmed to 40 chars", () => {
  const longName = "Kjempelang drakehorn-navnet som aldri tar slutt i det hele tatt";
  const outfit = outfitOf(normalizeDesignPayload(
    { prompt: "rare deler", itemType: "classic_shirt" },
    { outfit: { customParts: [
      { name: "  Pannehorn  ", shape: "horn", attach: "forehead", color: "#facc15", size: "medium" },
      { name: "ドラゴンの角", shape: "spike", attach: "back", color: "#ef4444", size: "small" },
      { name: longName, shape: "orb", attach: "left_hand", color: "#22d3ee", size: "large" },
      { name: "", shape: "fin", attach: "hips", color: "#a855f7", size: "medium" },
    ] } },
  ));
  assert.equal(outfit.customParts[0].name, "Pannehorn");
  assert.equal(outfit.customParts[1].name, "ドラゴンの角");
  assert.equal(outfit.customParts[2].name, longName.slice(0, 40));
  // empty name falls back to the shape keyword
  assert.equal(outfit.customParts[3].name, "fin");
});

test("customParts: more than 4 parts are truncated to the first 4", () => {
  const many = ["forehead", "head_top", "chest", "back", "belly", "hips", "left_hand"].map((attach, i) => ({
    name: `Del ${i + 1}`, shape: "orb", attach, color: "#112233", size: "large",
  }));
  const outfit = outfitOf(normalizeDesignPayload(
    { prompt: "mange deler", itemType: "classic_shirt" },
    { outfit: { customParts: many } },
  ));
  assert.equal(outfit.customParts.length, 4);
  assert.deepEqual(outfit.customParts.map((p) => p.attach), ["forehead", "head_top", "chest", "back"]);
});

test("customParts: invalid shape/attach rows are dropped, valid rows survive", () => {
  const outfit = outfitOf(normalizeDesignPayload(
    { prompt: "rare deler", itemType: "classic_shirt" },
    { outfit: { customParts: [
      { name: "Ugyldig", shape: "tentacle", attach: "forehead", color: "#112233", size: "large" },
      { name: "Feil feste", shape: "horn", attach: "elbow", color: "#112233", size: "large" },
      { name: "OK", shape: "headcover", attach: "face", color: "not-a-color", size: "gigantic" },
      42,
      null,
    ] } },
  ));
  assert.equal(outfit.customParts.length, 1);
  assert.equal(outfit.customParts[0].shape, "headcover");
  // invalid color/size fall back to safe defaults
  assert.match(outfit.customParts[0].color, /^#[0-9a-fA-F]{6}$/);
  assert.equal(outfit.customParts[0].size, "medium");
});

test("customParts revision: fully malformed array does not erase previous parts", () => {
  const prevWithParts: Outfit = {
    ...previousOutfit,
    customParts: [{ name: "Pannehorn", shape: "horn", attach: "forehead", color: "#facc15", size: "medium" }],
  };
  const outfit = outfitOf(normalizeDesignPayload(
    { prompt: "endre litt", itemType: "classic_shirt", previousOutfit: prevWithParts },
    { outfit: { customParts: [{ shape: "nonsense", attach: "nowhere" }] } },
  ));
  assert.deepEqual(outfit.customParts, prevWithParts.customParts);
});

test("customParts revision: explicit empty array removes parts", () => {
  const prevWithParts: Outfit = {
    ...previousOutfit,
    customParts: [{ name: "Pannehorn", shape: "horn", attach: "forehead", color: "#facc15", size: "medium" }],
  };
  const outfit = outfitOf(normalizeDesignPayload(
    { prompt: "fjern hornet", itemType: "classic_shirt", previousOutfit: prevWithParts },
    { outfit: { customParts: [] } },
  ));
  assert.deepEqual(outfit.customParts, []);
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
