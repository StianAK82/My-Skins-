import { z } from "zod";
import { routeAiIntent } from "./ai-intent-router";
import type { aiGenerateRequestSchema } from "./ai-contracts";

export type NormalizeInput = z.infer<typeof aiGenerateRequestSchema>;

export function normalizeHex(color: unknown): string | null {
  if (typeof color !== "string") return null;
  const trimmed = color.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null;
  return withHash.toUpperCase();
}

export function mapModuleType(value: unknown): string {
  if (typeof value !== "string") return "graphic";
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    graphic: "graphic",
    trim: "trim",
    pattern: "pattern",
    sleeve_detail: "sleeve_detail",
    sleeve: "sleeve_detail",
    chest_symbol: "chest_symbol",
    logo: "chest_symbol",
    stripe: "stripe",
    stripes: "stripe",
  };
  return map[normalized] ?? "graphic";
}

export function toPreviewSlot(name: string): "face" | "hair" | "hat" | "neck" | "leftShoulder" | "rightShoulder" | "back" | "leftFootwear" | "rightFootwear" | "aura" {
  const text = name.toLowerCase();
  if (text.includes("hair")) return "hair";
  if (text.includes("face") || text.includes("eye")) return "face";
  if (text.includes("wing") || text.includes("back")) return "back";
  if (text.includes("horn") || text.includes("hat") || text.includes("halo")) return "hat";
  if (text.includes("boot") || text.includes("shoe")) return "leftFootwear";
  if (text.includes("aura") || text.includes("glow") || text.includes("flame")) return "aura";
  if (text.includes("shoulder")) return "leftShoulder";
  return "neck";
}

export function roleForTerm(name: string): "hero" | "support" | "decorative" {
  const text = name.toLowerCase();
  if (text.includes("wing") || text.includes("horn") || text.includes("halo") || text.includes("dragon") || text.includes("demon")) return "hero";
  if (text.includes("aura") || text.includes("spark") || text.includes("glow") || text.includes("flame")) return "decorative";
  return "support";
}

export function normalizeDesignPayload(input: NormalizeInput, payload: unknown): unknown {
  const raw = (payload && typeof payload === "object") ? payload as Record<string, unknown> : {};
  const source = (raw.result && typeof raw.result === "object") ? raw.result as Record<string, unknown> : raw;
  const itemType = input.itemType;
  const intent = routeAiIntent(input.prompt, input.style, input.theme);

  const fallbackPalette = ["#1F2937", "#2563EB", "#F9FAFB"];
  const palette = Array.isArray(source.colorPalette)
    ? source.colorPalette.map(normalizeHex).filter((value): value is string => Boolean(value)).slice(0, 8)
    : [];
  const colorPalette = (palette.length >= 2 ? palette : fallbackPalette).slice(0, 8);

  const modulesRaw = Array.isArray(source.modules) ? source.modules : [];
  const modules = modulesRaw.slice(0, 50).map((module, index) => {
    const row = (module && typeof module === "object") ? module as Record<string, unknown> : {};
    const moduleColor = normalizeHex(row.color) ?? colorPalette[index % colorPalette.length] ?? "#2563EB";
    const position = (row.position && typeof row.position === "object") ? row.position as Record<string, unknown> : {};
    return {
      id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : `module-${index + 1}`,
      type: mapModuleType(row.type),
      label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : `Module ${index + 1}`,
      color: moduleColor,
      position: {
        x: typeof position.x === "number" ? Math.min(1, Math.max(0, position.x)) : 0.5,
        y: typeof position.y === "number" ? Math.min(1, Math.max(0, position.y)) : 0.5,
      },
      scale: typeof row.scale === "number" ? Math.min(4, Math.max(0.1, row.scale)) : 1,
      rotation: typeof row.rotation === "number" ? Math.min(360, Math.max(-360, row.rotation)) : 0,
      opacity: typeof row.opacity === "number" ? Math.min(1, Math.max(0, row.opacity)) : 0.95,
      layer: typeof row.layer === "number" ? Math.max(0, Math.round(row.layer)) : index,
    };
  });

  const placementSource = (source.placement && typeof source.placement === "object") ? source.placement as Record<string, unknown> : {};
  const placement = {
    front: typeof placementSource.front === "string" && placementSource.front.trim() ? placementSource.front : "front focal graphic",
    back: typeof placementSource.back === "string" && placementSource.back.trim() ? placementSource.back : "back supporting graphic",
    leftSleeve: itemType === "classic_shirt"
      ? (typeof placementSource.leftSleeve === "string" && placementSource.leftSleeve.trim() ? placementSource.leftSleeve : "accent stripe")
      : "not_used",
    rightSleeve: itemType === "classic_shirt"
      ? (typeof placementSource.rightSleeve === "string" && placementSource.rightSleeve.trim() ? placementSource.rightSleeve : "accent stripe")
      : "not_used",
    leftLeg: itemType === "classic_pants"
      ? (typeof placementSource.leftLeg === "string" && placementSource.leftLeg.trim() ? placementSource.leftLeg : "leg accent panel")
      : "not_used",
    rightLeg: itemType === "classic_pants"
      ? (typeof placementSource.rightLeg === "string" && placementSource.rightLeg.trim() ? placementSource.rightLeg : "leg accent panel")
      : "not_used",
  };

  const editorSource = (source.editorInstructions && typeof source.editorInstructions === "object")
    ? source.editorInstructions as Record<string, unknown>
    : {};
  const notes = Array.isArray(editorSource.notes)
    ? editorSource.notes.filter((note): note is string => typeof note === "string" && Boolean(note.trim())).slice(0, 8)
    : [];

  const designElements = Array.isArray(source.designElements)
    ? source.designElements.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())).slice(0, 12)
    : [];

  const accessoryTerms = ["wings", "horns", "halo", "boots", "hat", "hair", "aura", "glowing eyes"];
  const accessoryItems = accessoryTerms
    .filter((term) => input.prompt.toLowerCase().includes(term.replace(/s$/, "")) || input.prompt.toLowerCase().includes(term))
    .map((term) => ({
      name: term,
      slot: toPreviewSlot(term),
      detail: `Preview cosmetic inspired by ${term}`,
      role: roleForTerm(term),
      exportStatus: "preview_only" as const,
    }))
    .slice(0, 8);

  const avatarSlotPlan = accessoryItems.map((item, idx) => ({
    slot: item.slot,
    assetHint: `${item.name.replace(/\s+/g, "_")}_${idx + 1}`,
    role: item.role,
    rationale: `Mapped from prompt accessory term "${item.name}"`,
    color: colorPalette[idx % colorPalette.length],
  }));

  if (intent.includesAvatarLook && !avatarSlotPlan.some((slot) => slot.slot === "face")) {
    avatarSlotPlan.push({ slot: "face", assetHint: intent.fantasyArchetype ? `face_${intent.fantasyArchetype}_eyes` : "face_stylized", role: "support", rationale: "Face clarity for avatar identity", color: colorPalette[0] });
  }
  // Only style the hair when the user actually mentions hair — otherwise leave it alone.
  const mentionsHair = /\bhår|hair|frisyre|sveis|hårete\b/i.test([input.prompt, input.theme ?? "", input.style ?? ""].join(" "));
  if (!mentionsHair) {
    const hairIndex = avatarSlotPlan.findIndex((slot) => slot.slot === "hair");
    if (hairIndex >= 0) avatarSlotPlan.splice(hairIndex, 1);
  } else if (intent.includesAvatarLook && !avatarSlotPlan.some((slot) => slot.slot === "hair")) {
    avatarSlotPlan.push({ slot: "hair", assetHint: intent.styleVibes.includes("anime") ? "hair_anime_layered" : "hair_wavy_midnight", role: "support", rationale: "Hair establishes style silhouette", color: colorPalette[1] });
  }

  const outfitSource = (source.outfit && typeof source.outfit === "object") ? source.outfit as Record<string, unknown> : {};
  const topOptions = ["hoodie", "sweater", "tshirt", "jacket", "dress", "none"] as const;
  const bottomOptions = ["pants", "shorts", "skirt", "none"] as const;
  const shoeOptions = ["none", "sneakers", "boots"] as const;
  const hairStyles = ["none", "short", "long", "ponytail", "twintails", "spiky", "curly", "braids", "wavy", "snakes"] as const;
  const accessoryKinds = ["cap", "beanie", "hat", "helmet", "crown", "glasses", "mask", "wings", "backpack", "bag", "necklace", "scarf", "horns", "tail", "belt", "gloves", "unicorn_horn", "dragon_hood", "jetpack", "sword", "shoulder_guards", "shoulder_pet", "aura", "flame_aura", "pixel_aura"] as const;
  const accessorySizes = ["small", "medium", "large"] as const;

  const hairSource = (outfitSource.hair && typeof outfitSource.hair === "object") ? outfitSource.hair as Record<string, unknown> : {};
  const accessoriesSource = Array.isArray(outfitSource.accessories) ? outfitSource.accessories : null;
  // In revision mode any missing/invalid field falls back to the previous outfit,
  // so unmentioned parts are never reset by a sloppy model response.
  const prev = input.previousOutfit;
  const outfit = {
    top: topOptions.includes(outfitSource.top as typeof topOptions[number]) ? outfitSource.top as typeof topOptions[number] : (prev?.top ?? "sweater"),
    bottom: bottomOptions.includes(outfitSource.bottom as typeof bottomOptions[number]) ? outfitSource.bottom as typeof bottomOptions[number] : (prev?.bottom ?? "pants"),
    shoes: shoeOptions.includes(outfitSource.shoes as typeof shoeOptions[number]) ? outfitSource.shoes as typeof shoeOptions[number] : (prev?.shoes ?? "none"),
    ...(() => {
      const c = (typeof outfitSource.shoesColor === "string" && /^#[0-9a-fA-F]{6}$/.test(outfitSource.shoesColor)) ? outfitSource.shoesColor : prev?.shoesColor;
      return c ? { shoesColor: c } : {};
    })(),
    ...(() => {
      const extra: Record<string, string> = {};
      const top = typeof outfitSource.topDescription === "string" && outfitSource.topDescription.trim() ? outfitSource.topDescription.trim().slice(0, 400) : prev?.topDescription;
      const bottom = typeof outfitSource.bottomDescription === "string" && outfitSource.bottomDescription.trim() ? outfitSource.bottomDescription.trim().slice(0, 400) : prev?.bottomDescription;
      if (top) extra.topDescription = top;
      if (bottom) extra.bottomDescription = bottom;
      return extra;
    })(),
    hair: {
      style: hairStyles.includes(hairSource.style as typeof hairStyles[number]) ? hairSource.style as typeof hairStyles[number] : (prev?.hair.style ?? "none"),
      color: normalizeHex(hairSource.color) ?? prev?.hair.color ?? "#1f2937",
    },
    accessories: (accessoriesSource ?? prev?.accessories ?? []).slice(0, 6).flatMap((entry) => {
      const row = (entry && typeof entry === "object") ? entry as Record<string, unknown> : {};
      if (!accessoryKinds.includes(row.kind as typeof accessoryKinds[number])) return [];
      const previous = prev?.accessories.find((accessory) => accessory.kind === row.kind);
      return [{
        kind: row.kind as typeof accessoryKinds[number],
        color: normalizeHex(row.color) ?? previous?.color ?? colorPalette[0] ?? "#334155",
        size: accessorySizes.includes(row.size as typeof accessorySizes[number]) ? row.size as typeof accessorySizes[number] : previous?.size ?? "medium",
      }];
    }),
    customParts: (() => {
      const shapes = ["horn", "spike", "orb", "plate", "band", "snake", "fin", "blob", "headcover"] as const;
      const attaches = ["forehead", "head_top", "face", "neck", "chest", "belly", "back", "hips", "left_shoulder", "right_shoulder", "left_hand", "right_hand", "left_leg", "right_leg", "left_foot", "right_foot"] as const;
      const sizes = ["small", "medium", "large"] as const;
      const modelSent = Array.isArray(outfitSource.customParts);
      const src = modelSent ? outfitSource.customParts as unknown[] : (prev?.customParts ?? []);
      const parsed = src.slice(0, 4).flatMap((entry, idx) => {
        const row = (entry && typeof entry === "object") ? entry as Record<string, unknown> : {};
        if (!shapes.includes(row.shape as typeof shapes[number])) return [];
        if (!attaches.includes(row.attach as typeof attaches[number])) return [];
        // In revision mode, partial rows inherit color/size from the matching previous part
        // (same shape+attach, else same index) instead of palette defaults.
        const prevMatch = prev?.customParts?.find((p) => p.shape === row.shape && p.attach === row.attach) ?? prev?.customParts?.[idx];
        return [{
          name: typeof row.name === "string" && row.name.trim() ? row.name.trim().slice(0, 40) : (prevMatch?.name ?? String(row.shape)),
          shape: row.shape as typeof shapes[number],
          attach: row.attach as typeof attaches[number],
          color: normalizeHex(row.color) ?? prevMatch?.color ?? colorPalette[0] ?? "#334155",
          size: sizes.includes(row.size as typeof sizes[number]) ? row.size as typeof sizes[number] : (prevMatch?.size ?? "medium"),
        }];
      });
      // Revision safety: a malformed array (every row invalid) must not silently erase
      // existing parts — only an explicit empty array [] means removal.
      if (modelSent && parsed.length === 0 && (outfitSource.customParts as unknown[]).length > 0 && prev?.customParts?.length) {
        return prev.customParts;
      }
      return parsed;
    })(),
    unsupported: Array.isArray(outfitSource.unsupported)
      ? outfitSource.unsupported.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())).slice(0, 6)
      : [],
    reason: typeof outfitSource.reason === "string" ? outfitSource.reason.slice(0, 300) : "",
  };
  // Backwards-compatible summary used by older clients.
  const garments = {
    top: (outfit.top === "dress" ? "jacket" : outfit.top) as "hoodie" | "sweater" | "tshirt" | "jacket" | "none",
    bottom: (outfit.bottom === "skirt" ? "shorts" : outfit.bottom) as "pants" | "shorts" | "none",
    shoes: outfit.shoes !== "none",
    reason: outfit.reason,
  };

  return {
    outfit,
    garments,
    title: typeof source.title === "string" && source.title.trim() ? source.title.trim() : "Generated Roblox Design",
    itemType,
    style: typeof source.style === "string" && source.style.trim() ? source.style.trim() : (input.style ?? "Generated"),
    target: "roblox",
    theme: typeof source.theme === "string" && source.theme.trim() ? source.theme.trim() : (input.theme ?? input.prompt.slice(0, 80)),
    colorPalette,
    designElements: designElements.length > 0 ? designElements : ["core motif"],
    intent,
    clothingPlan: {
      summary: `Classic ${itemType === "classic_shirt" ? "shirt" : "pants"} plan for ${input.prompt}`,
      layers: designElements.length > 0 ? designElements.slice(0, 8) : ["base fill", "main motif", "accent trim"],
      paletteLogic: `Use ${colorPalette[0]} as base, ${colorPalette[1]} for hero contrast, and keep trim readable at Roblox distance.`,
    },
    avatarLookPlan: {
      identity: intent.fantasyArchetype ? `${intent.fantasyArchetype} inspired avatar` : "cohesive stylized avatar",
      silhouette: intent.includesAccessories ? "strong accessory silhouette" : "clean readable silhouette",
      hair: intent.styleVibes.includes("anime") ? "high-volume anime hair" : "structured modern hair",
      face: intent.includesEffects ? "high-contrast glowing eyes" : "clean expression",
      aura: intent.includesEffects ? "energy aura" : null,
    },
    accessoryPlan: {
      items: accessoryItems,
    },
    previewOnlyPlan: {
      cosmetics: avatarSlotPlan.map((slot) => ({
        category: slot.slot === "aura" ? "effect" : "accessory",
        label: slot.assetHint,
        slot: slot.slot,
        role: slot.role,
      })),
    },
    exportablePlan: {
      classicShirt: itemType === "classic_shirt",
      classicPants: itemType === "classic_pants",
      notes: [
        "Classic shirt/pants layers are exportable now.",
        "Avatar cosmetics and creature accessories are preview-only in this release.",
      ],
    },
    avatarSlotPlan: avatarSlotPlan.slice(0, 12),
    placement,
    modules,
    editorInstructions: {
      baseTemplate: typeof editorSource.baseTemplate === "string" && editorSource.baseTemplate.trim()
        ? editorSource.baseTemplate
        : `${itemType}_default`,
      recommendedPreset: typeof editorSource.recommendedPreset === "string" && editorSource.recommendedPreset.trim()
        ? editorSource.recommendedPreset
        : (input.style ?? "custom"),
      notes: notes.length > 0 ? notes : ["Keep contrast high for Roblox readability."],
    },
  };
}
