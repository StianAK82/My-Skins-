import { z } from "zod";

const itemSchema = z.object({
  id: z.string(), category: z.enum(["top", "bottom", "one_piece", "footwear", "hair", "accessory"]),
  kind: z.string(), label: z.string(), colors: z.array(z.string()).min(1), size: z.enum(["small", "medium", "large"]),
  previewCapability: z.enum(["supported", "preview_only", "unsupported"]),
  exportCapability: z.enum(["classic_shirt", "classic_pants", "none"]),
  fallback: z.object({ state: z.enum(["none", "used", "unavailable"]), message: z.string().nullable() }),
  unsupported: z.object({ state: z.boolean(), reason: z.string().nullable() }),
}).passthrough();
export const universalOutfitSpecSchema = z.object({
  schemaVersion: z.literal("1.0"), generationId: z.string(), normalizedUserIntent: z.string(),
  items: z.array(itemSchema), revisionHistory: z.array(z.unknown()), validationEvidence: z.array(z.object({ validator: z.string(), passed: z.boolean(), reasons: z.array(z.string()) })),
  quality: z.object({ score: z.number(), threshold: z.number(), accepted: z.boolean(), dimensions: z.record(z.string(), z.number()), failureReasons: z.array(z.string()) }),
  repairHistory: z.array(z.unknown()),
}).passthrough();
export type UniversalOutfitSpec = z.infer<typeof universalOutfitSpecSchema>;
export type CanonicalLifecycle = "idle" | "generating" | "validating" | "repairing" | "routing" | "rendering" | "complete" | "error" | "unsupported" | "external_verification_required";

/** Rendering-only projection. It deliberately contains no product decisions. */
export type PreviewSceneSpec = { generationId: string; items: Array<{ itemId: string; kind: string; color: string; size: string }> };
export function toPreviewSceneSpec(spec: UniversalOutfitSpec): PreviewSceneSpec {
  return { generationId: spec.generationId, items: spec.items.filter(i => !i.unsupported.state && i.previewCapability !== "unsupported").map(i => ({ itemId: i.id, kind: i.kind, color: i.colors[0], size: i.size })) };
}

export function toCreatePresentation(spec: UniversalOutfitSpec) {
  const uploadable = spec.items.filter(i => i.exportCapability !== "none" && !i.unsupported.state).map(i => i.label);
  const previewOnly = spec.items.filter(i => i.exportCapability === "none" && !i.unsupported.state).map(i => i.label);
  const unsupported = spec.items.filter(i => i.unsupported.state).map(i => i.unsupported.reason ?? i.label);
  return { uploadable, previewOnly, unsupported };
}


export function reconcileCanonicalRevision(previous: UniversalOutfitSpec, candidate: UniversalOutfitSpec, instruction: string): UniversalOutfitSpec {
  const used = new Set<string>();
  const items = candidate.items.map(item => {
    const exact = previous.items.find(old => !used.has(old.id) && old.category === item.category && old.kind === item.kind);
    const replacement = exact ?? previous.items.find(old => !used.has(old.id) && old.category === item.category);
    if (!replacement) return item;
    used.add(replacement.id);
    return { ...item, id: replacement.id };
  });
  const changedPaths: string[] = [];
  for (const item of items) {
    const old = previous.items.find(candidateItem => candidateItem.id === item.id);
    if (!old) changedPaths.push(`items.${item.id}`);
    else for (const key of ["kind", "colors", "size"] as const)
      if (JSON.stringify(old[key]) !== JSON.stringify(item[key])) changedPaths.push(`items.${item.id}.${key}`);
  }
  return universalOutfitSpecSchema.parse({ ...candidate, items, revisionHistory: [...previous.revisionHistory, {
    revisionId: crypto.randomUUID(), instructionHash: "client-redacted", changedPaths, createdAt: new Date().toISOString(),
  }] });
}
