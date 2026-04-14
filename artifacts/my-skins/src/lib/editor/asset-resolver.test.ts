import test from "node:test";
import assert from "node:assert/strict";
import { resolveAvatarSlotAssets } from "../ai/asset-resolver.ts";
import type { NormalizedAiResponse } from "../ai/normalize-ai-response.ts";

const baseResult: NormalizedAiResponse["result"] = {
  title: "Dragon Look",
  itemType: "classic_shirt",
  style: "Fantasy",
  target: "roblox",
  theme: "dragon warrior",
  colorPalette: ["#F97316", "#111827", "#E2E8F0"],
  designElements: ["wings", "horns"],
  intent: {
    primaryFocus: "mixed",
    requestKinds: ["avatar_look", "creature_fantasy", "effect_aura"],
    styleVibes: ["fantasy", "dragon", "dark_flame"],
    includesAvatarLook: true,
    includesAccessories: true,
    includesEffects: true,
    fantasyArchetype: "dragon",
  },
  clothingPlan: { summary: "", layers: [""], paletteLogic: "" },
  avatarLookPlan: { identity: "", silhouette: "", hair: "", face: "", aura: null },
  accessoryPlan: { items: [] },
  previewOnlyPlan: { cosmetics: [] },
  exportablePlan: { classicShirt: true, classicPants: false, notes: ["test"] },
  avatarSlotPlan: [
    { slot: "back", assetHint: "dragon_wings", role: "hero", rationale: "hero silhouette", color: "#F97316" },
    { slot: "hat", assetHint: "horns", role: "hero", rationale: "creature identity", color: "#111827" },
    { slot: "aura", assetHint: "flame_aura", role: "decorative", rationale: "effects", color: "#F97316" },
  ],
  placement: { front: "x", back: "x", leftSleeve: "x", rightSleeve: "x", leftLeg: "not_used", rightLeg: "not_used" },
  modules: [],
  editorInstructions: { baseTemplate: "x", recommendedPreset: "x", notes: ["x"] },
};

test("asset resolver picks coherent fantasy hero/support assets", () => {
  const resolved = resolveAvatarSlotAssets(baseResult);
  const back = resolved.find((entry) => entry.slot === "back");
  const hat = resolved.find((entry) => entry.slot === "hat");
  const aura = resolved.find((entry) => entry.slot === "aura");

  assert.equal(back?.assetId, "back_blade_rig");
  assert.equal(hat?.assetId, "hat_cyber_horns");
  assert.equal(aura?.assetId, "aura_flame_orbit");
  assert.equal(back?.role, "hero");
  assert.equal(aura?.role, "decorative");
});
