import assert from "node:assert/strict";
import test from "node:test";
import { mapPreviewMaterial, repairPreview, solvePreviewFit, validatePreview, type PreviewItem } from "./visual-quality";

const item = (itemId: string, kind: string, category = "accessory"): PreviewItem => ({ itemId, kind, category, color: "#111111", material: "cotton", size: "medium", placement: category, layeringOrder: 1 });
test("material mapping keeps fabric and metallic surfaces distinct", () => { assert.ok(mapPreviewMaterial("denim").roughness > mapPreviewMaterial("satin-like").roughness); assert.ok(mapPreviewMaterial("metallic").metalness > .8); });
test("fit solver reports stable ids and bounded corrections without removing items", () => { const items = [item("hair-1", "long_hair", "hair"), item("cap-1", "cap"), item("wing-1", "wings"), item("pack-1", "backpack")]; const fit = solvePreviewFit(items); assert.equal(fit.items.length, 4); assert.deepEqual(fit.conflicts[0].affectedItemIds, ["hair-1", "cap-1"]); assert.ok(fit.conflicts.every(c => c.correctionApplied.length > 0 && c.overlap <= .12)); });
test("visual gate is strict for missing items and paired footwear", () => { const report = validatePreview([item("shoe-1", "shoes", "footwear")], ["shoe-1", "top-1"]); assert.equal(report.passed, false); assert.match(report.criticalFailures[0], /missing requested item/); assert.equal(Object.keys(report.dimensions).length, 12); });
test("bounded repair records unresolved local issue and never invents an item", () => { const result = repairPreview([], ["coat-1"], 2); assert.equal(result.items.length, 0); assert.equal(result.history.length, 1); assert.equal(result.history[0].accepted, false); });
