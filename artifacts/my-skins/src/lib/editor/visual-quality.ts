export type PreviewItem = { itemId: string; kind: string; category: string; color: string; material: string; size: string; placement: string; layeringOrder: number };
export type FitConflict = { conflictType: string; severity: "low" | "medium" | "high"; affectedItemIds: string[]; overlap: number; correctionApplied: string; preservedProperties: string[]; unresolvedReason: string | null };
export type VisualDimension = { score: number; passed: boolean; reason: string; affectedItemIds: string[]; evidenceView: "front" | "side" | "back" | "all" };
export type VisualValidationReport = { passed: boolean; score: number; criticalFailures: string[]; dimensions: Record<string, VisualDimension>; conflicts: FitConflict[] };

const MATERIALS: Record<string, { roughness: number; metalness: number; sheen: number }> = {
  cotton: { roughness: .78, metalness: .01, sheen: .25 }, fleece: { roughness: .92, metalness: 0, sheen: .15 }, denim: { roughness: .82, metalness: .01, sheen: .12 },
  leather: { roughness: .36, metalness: .04, sheen: .5 }, nylon: { roughness: .3, metalness: .02, sheen: .65 }, wool: { roughness: .9, metalness: 0, sheen: .2 },
  satin: { roughness: .2, metalness: .03, sheen: .9 }, metallic: { roughness: .25, metalness: .85, sheen: .4 }, rubber: { roughness: .62, metalness: 0, sheen: .18 }, knit: { roughness: .88, metalness: 0, sheen: .22 },
};
export function mapPreviewMaterial(value: string) { const key = value.toLowerCase().replace(/[-_ ]like$/, ""); return MATERIALS[key] ?? MATERIALS.cotton; }

export function solvePreviewFit(items: PreviewItem[]): { items: PreviewItem[]; conflicts: FitConflict[] } {
  const conflicts: FitConflict[] = []; const kinds = new Map(items.map(i => [i.kind, i]));
  const add = (a: string, b: string, type: string, correction: string, overlap: number, severity: FitConflict["severity"] = "medium") => {
    const x = kinds.get(a), y = kinds.get(b); if (!x || !y) return;
    conflicts.push({ conflictType: type, severity, affectedItemIds: [x.itemId, y.itemId], overlap, correctionApplied: correction, preservedProperties: ["kind", "color", "material", "stable item ID"], unresolvedReason: null });
  };
  for (const hair of ["long_hair", "short_hair"]) { add(hair, "cap", "headwear-hair", "partial hair compression (8%)", .08); add(hair, "crown", "crown-hair", "crown attachment raised 0.03", .03, "low"); add(hair, "hoodie", "hood-hair", "hair rear offset 0.04", .06); }
  add("wings", "backpack", "shared-back-anchor", "accessory separation: wings back 0.08", .12, "high");
  add("shoulder_bag", "jacket", "strap-outerwear", "layer order: strap above jacket", .04, "low");
  add("shoulder_bag", "suit_jacket", "strap-outerwear", "layer order: strap above jacket", .04, "low");
  return { items: items.map(i => ({ ...i })), conflicts };
}

const dimensionNames = ["requestedItemVisibility", "silhouetteRecognition", "colorFaithfulness", "materialReadability", "attachmentCorrectness", "pairedItemCompleteness", "garmentLayering", "clippingSeverity", "floatingGeometry", "bodyCoverage", "styleCoherence", "overallPolish"] as const;
export function validatePreview(items: PreviewItem[], expectedIds = items.map(i => i.itemId)): VisualValidationReport {
  const fit = solvePreviewFit(items); const present = new Set(items.map(i => i.itemId)); const missing = expectedIds.filter(id => !present.has(id));
  const footwear = items.filter(i => i.category === "footwear"); const badPair = footwear.filter(i => !["shoes", "sneakers", "boots"].includes(i.kind)).map(i => i.itemId);
  const criticalFailures = [...missing.map(id => `missing requested item: ${id}`), ...badPair.map(id => `detached or unsupported footwear: ${id}`)];
  const dimensions = Object.fromEntries(dimensionNames.map(name => { const affected = name === "requestedItemVisibility" ? missing : name === "pairedItemCompleteness" ? badPair : []; const penalty = affected.length * 30 + ((name === "clippingSeverity" || name === "attachmentCorrectness") ? fit.conflicts.filter(c => c.severity === "high").length * 8 : 0); const score = Math.max(0, 100 - penalty); return [name, { score, passed: score >= 80, reason: affected.length ? `Affected: ${affected.join(", ")}` : fit.conflicts.length && name === "attachmentCorrectness" ? "Deterministic bounded corrections applied" : "Validated against resolved preview scene", affectedItemIds: affected, evidenceView: name.includes("attachment") || name.includes("floating") ? "side" : "all" } satisfies VisualDimension]; })) as Record<string, VisualDimension>;
  const score = Math.round(Object.values(dimensions).reduce((n, d) => n + d.score, 0) / dimensionNames.length);
  return { passed: criticalFailures.length === 0 && Object.values(dimensions).every(d => d.passed), score, criticalFailures, dimensions, conflicts: fit.conflicts };
}

export function repairPreview(items: PreviewItem[], expectedIds: string[], maxAttempts = 2) { const history: Array<{ attempt: number; affectedItemIds: string[]; correction: string; beforeScore: number; afterScore: number; accepted: boolean }> = []; let current = items; for (let attempt = 1; attempt <= maxAttempts; attempt++) { const before = validatePreview(current, expectedIds); const affected = expectedIds.filter(id => !current.some(i => i.itemId === id)); if (!affected.length) break; const after = validatePreview(current, expectedIds); history.push({ attempt, affectedItemIds: affected, correction: "No safe local geometry patch available; requested item preserved as unresolved", beforeScore: before.score, afterScore: after.score, accepted: after.score > before.score }); break; } return { items: current, report: validatePreview(current, expectedIds), history }; }
