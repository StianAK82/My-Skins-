import assert from "node:assert/strict";
import test from "node:test";
import { reconcileCanonicalRevision, toCreatePresentation, toPreviewSceneSpec, universalOutfitSpecSchema } from "../ai/universal-outfit";
const spec = universalOutfitSpecSchema.parse({ schemaVersion: "1.0", generationId: "g", normalizedUserIntent: "wings", items: [
  { id: "top-hoodie-01", category: "top", kind: "hoodie", label: "hoodie", colors: ["#000000"], size: "medium", previewCapability: "supported", exportCapability: "classic_shirt", fallback: { state: "none", message: null }, unsupported: { state: false, reason: null } },
  { id: "accessory-wings-01", category: "accessory", kind: "wings", label: "wings", colors: ["#FFFFFF"], size: "medium", previewCapability: "supported", exportCapability: "none", fallback: { state: "none", message: null }, unsupported: { state: false, reason: null } },
], revisionHistory: [], validationEvidence: [], quality: { score: 94, threshold: 78, accepted: true, dimensions: { previewStability: 94 }, failureReasons: [] }, repairHistory: [] });
test("canonical preview and child-facing lists are read-only projections", () => {
  assert.equal(toPreviewSceneSpec(spec).items.length, 2);
  assert.deepEqual(toCreatePresentation(spec), { uploadable: ["hoodie"], previewOnly: ["wings"], unsupported: [] });
});
test("revision preserves stable IDs and unrelated garments", () => {
  const candidate = structuredClone(spec); candidate.items[1].size = "large";
  const revised = reconcileCanonicalRevision(spec, candidate, "Make only the wings larger");
  assert.deepEqual(revised.items[0], spec.items[0]);
  assert.equal(revised.items[1].id, spec.items[1].id);
  assert.equal(revised.items[1].size, "large");
});
test("canonical adapter drives garment and accessory renderer props", async () => {
  const { toAvatarPreviewOutfit } = await import("../ai/universal-outfit"); const candidate = structuredClone(spec); candidate.items[0].kind = "zip_hoodie"; candidate.items.push({ id: "accessory-backpack-01", category: "accessory", kind: "backpack", label: "backpack", colors: ["#333333"], size: "small", previewCapability: "supported", exportCapability: "none", fallback: { state: "none", message: null }, unsupported: { state: false, reason: null } }); const preview = toAvatarPreviewOutfit(candidate); assert.equal(preview.top, "zip_hoodie"); assert.equal(preview.accessories[1].kind, "backpack");
});
