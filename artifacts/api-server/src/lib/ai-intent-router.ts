const FOCUS_KEYWORDS: Array<{ focus: "clothing" | "outfit" | "avatar_look" | "accessory" | "creature_fantasy" | "effect_aura"; terms: string[] }> = [
  { focus: "clothing", terms: ["shirt", "pants", "hoodie", "jacket", "outfit", "clothes", "jersey"] },
  { focus: "avatar_look", terms: ["avatar", "look like", "face", "hair", "eyes", "skin"] },
  { focus: "accessory", terms: ["hat", "wings", "horn", "back", "shoulder", "boots", "neck", "accessory"] },
  { focus: "creature_fantasy", terms: ["dragon", "demon", "angel", "beast", "creature", "monster"] },
  { focus: "effect_aura", terms: ["aura", "glow", "glowing", "flame", "fire", "spark", "energy"] },
  { focus: "outfit", terms: ["full look", "full body", "head to toe", "make me", "style me"] },
];

const VIBE_TERMS: Record<string, string[]> = {
  anime: ["anime", "manga"],
  cyber: ["cyber", "neon", "tech", "futur"],
  dark_flame: ["dark", "flame", "fire", "inferno"],
  fantasy: ["fantasy", "magic", "mythic"],
  cute: ["cute", "kawaii", "adorable"],
  tactical: ["tactical", "military", "ops", "combat"],
  streetwear: ["street", "streetwear", "urban"],
  villain: ["villain", "evil", "sinister"],
  dragon: ["dragon", "draconic"],
  angelic: ["angel", "angelic", "holy"],
  sporty: ["sport", "athletic", "runner", "jersey"],
};

export type AiFocus = "clothing" | "outfit" | "avatar_look" | "accessory" | "creature_fantasy" | "effect_aura" | "mixed";

export interface RoutedIntent {
  primaryFocus: AiFocus;
  requestKinds: AiFocus[];
  styleVibes: string[];
  includesAvatarLook: boolean;
  includesAccessories: boolean;
  includesEffects: boolean;
  fantasyArchetype: "dragon" | "demon" | "angel" | null;
}

export function routeAiIntent(prompt: string, styleHint?: string, themeHint?: string): RoutedIntent {
  const text = `${prompt} ${styleHint ?? ""} ${themeHint ?? ""}`.toLowerCase();
  const foundFocus = FOCUS_KEYWORDS
    .filter(({ terms }) => terms.some((term) => text.includes(term)))
    .map(({ focus }) => focus);

  const requestKinds = Array.from(new Set(foundFocus));
  const styleVibes = Object.entries(VIBE_TERMS)
    .filter(([, terms]) => terms.some((term) => text.includes(term)))
    .map(([vibe]) => vibe)
    .slice(0, 6);

  const includesAvatarLook = requestKinds.includes("avatar_look") || requestKinds.includes("creature_fantasy") || requestKinds.includes("outfit");
  const includesAccessories = requestKinds.includes("accessory") || requestKinds.includes("creature_fantasy") || text.includes("wings") || text.includes("horn");
  const includesEffects = requestKinds.includes("effect_aura") || text.includes("glow");

  const fantasyArchetype = text.includes("dragon")
    ? "dragon"
    : text.includes("demon")
      ? "demon"
      : (text.includes("angel") || text.includes("angelic"))
        ? "angel"
        : null;

  let primaryFocus: AiFocus = "clothing";
  if (requestKinds.length > 1) primaryFocus = "mixed";
  else if (requestKinds.length === 1) primaryFocus = requestKinds[0] as AiFocus;

  if (requestKinds.length === 0) {
    primaryFocus = "clothing";
    requestKinds.push("clothing");
  }

  return {
    primaryFocus,
    requestKinds,
    styleVibes,
    includesAvatarLook,
    includesAccessories,
    includesEffects,
    fantasyArchetype,
  };
}
