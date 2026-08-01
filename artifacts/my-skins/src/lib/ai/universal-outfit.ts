import { z } from "zod";
import { compileRenderedConstruction, type ConstructionItem } from "./rendered-construction";

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
  creativeDirection: z.object({ selected: z.object({
    id: z.string(), title: z.string(), story: z.string(),
    silhouette: z.object({ primaryShape: z.string(), largeForms: z.array(z.string()), secondaryForms: z.array(z.string()), asymmetry: z.string() }).passthrough(),
    heroElement: z.object({ name: z.string(), description: z.string(), bodyLocation: z.string(), memoryHook: z.string() }),
    palette: z.array(z.string()), materials: z.array(z.string()), garmentDirection: z.array(z.string()), accessoryDirection: z.array(z.string()), textureDirection: z.array(z.string()),
  }).passthrough() }).passthrough().optional(),
}).passthrough();
export type UniversalOutfitSpec = z.infer<typeof universalOutfitSpecSchema>;
export type CanonicalLifecycle = "idle" | "generating" | "validating" | "repairing" | "routing" | "rendering" | "complete" | "error" | "unsupported" | "external_verification_required";

/** Rendering-only projection. It deliberately contains no product decisions. */
export type PreviewSceneSpec = { generationId: string; items: Array<{ itemId: string; kind: string; category: string; color: string; material: string; size: string; placement: string; layeringOrder: number; construction: ConstructionItem }> };
export function toPreviewSceneSpec(spec: UniversalOutfitSpec): PreviewSceneSpec {
  const selected = spec.creativeDirection?.selected;
  return { generationId: spec.generationId, items: spec.items.filter(i => !i.unsupported.state && i.previewCapability !== "unsupported").map((i, index) => ({ itemId: i.id, kind: i.kind, category: i.category, color: selected?.palette[index % Math.max(selected.palette.length, 1)] ?? i.colors[0], material: selected?.materials[index % Math.max(selected.materials.length, 1)] ?? String(i.material ?? "cotton"), size: i.size, placement: String(i.placement ?? i.category), layeringOrder: Number(i.layeringOrder ?? index), construction: compileRenderedConstruction({ ...i, colors: selected?.palette.length ? selected.palette : i.colors, material: selected?.materials[index % Math.max(selected.materials.length, 1)] ?? i.material, creative: selected }) })) };
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

/** Read-only projection for existing AvatarPreview props; no capability decisions live here. */
export function toAvatarPreviewOutfit(spec: UniversalOutfitSpec) {
  const active = spec.items.filter(item => !item.unsupported.state); const find = (category: string) => active.find(item => item.category === category); const topItem = find("one_piece") ?? find("top"); const bottomItem = find("bottom"); const footwear = find("footwear"); const hair = find("hair");
  const tops: Record<string,string> = { hoodie:"hoodie", zip_hoodie:"zip_hoodie", tshirt:"tshirt", formal_shirt:"formal_jacket", football_jersey:"jersey", dress:"dress", jacket:"jacket", varsity_jacket:"jacket", winter_coat:"winter_coat", suit_jacket:"formal_jacket" }; const bottoms: Record<string,string> = { jeans:"jeans", joggers:"joggers", cargo_pants:"cargo_pants", formal_trousers:"pants", shorts:"shorts" };
  return { top: topItem ? (tops[topItem.kind] ?? "sweater") : "none", bottom: bottomItem ? (bottoms[bottomItem.kind] ?? "pants") : "none", shoes: footwear ? (footwear.kind === "boots" ? "boots" : "sneakers") : "none", shoesColor: footwear?.colors[0], topDescription: topItem?.label, bottomDescription: bottomItem?.label, hair: { style: hair ? (hair.kind === "long_hair" ? "long" : "short") : "none", color: hair?.colors[0] ?? "#111111" }, accessories: active.filter(item => item.category === "accessory").map(item => ({ kind: item.kind === "shoulder_bag" ? "bag" : item.kind, color: item.colors[0], size: item.size })), customParts: [], unsupported: spec.items.filter(item => item.unsupported.state).map(item => item.unsupported.reason ?? item.label), reason: spec.normalizedUserIntent };
}
