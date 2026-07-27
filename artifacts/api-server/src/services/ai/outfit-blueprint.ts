export type OutfitPart = {
  type: string;
  material?: string;
  colour: string;
  details?: string[];
};

export type OutfitBlueprint = {
  theme: string;
  style: string;
  primaryColours: string[];
  accentColours: string[];
  avatar: { bodyStyle: "Roblox-style"; skinTone: "default" };
  top: OutfitPart;
  bottom: OutfitPart;
  footwear: OutfitPart;
  accessories: string[];
  completeLook: string;
};

const COLOURS: Array<[RegExp, string]> = [
  [/\b(hvit(?:t|e)?|white)\b/i, "white"],
  [/\b(svart(?:e)?|black)\b/i, "black"],
  [/\b(blå|blaa|blue)\b/i, "blue"],
  [/\b(rosa|pink)\b/i, "pink"],
  [/\b(rød(?:t|e)?|red)\b/i, "red"],
  [/\b(grønn|green)\b/i, "green"],
];

/** Child-friendly, bilingual planning with coordinated defaults for omitted parts. */
export function planOutfitBlueprint(description: string): OutfitBlueprint {
  const text = description.toLowerCase();
  const found = COLOURS.filter(([pattern]) => pattern.test(text)).map(([, colour]) => colour);
  const primary = found[0] ?? "blue";
  const accent = found[1] ?? (primary === "white" ? "light grey" : primary === "black" ? "blue" : "white");
  const anime = /anime|kawaii|cute|søt/.test(text);
  const football = /football|fotball/.test(text);
  const fire = /fire|flamme/.test(text);
  const trousersOnly = /(bukse|pants|trousers|jeans)/.test(text) && !/(hood|hette|shirt|skjorte|genser|top)/.test(text);
  const topType = football ? "football jersey" : anime ? "anime sweatshirt" : /(hood|hette)/.test(text) || !trousersOnly ? "hoodie" : "coordinated sweatshirt";
  const bottomType = football ? "football shorts" : anime ? "pleated trousers" : "relaxed trousers";
  const style = football ? "football" : anime ? "cute anime" : fire ? "fire streetwear" : "streetwear";
  const graphic = football ? [`number ${text.match(/\b\d{1,2}\b/)?.[0] ?? "10"}`] : fire ? [`${accent} flames`] : [];
  return {
    theme: `${primary} ${style}`,
    style,
    primaryColours: [primary],
    accentColours: [accent],
    avatar: { bodyStyle: "Roblox-style", skinTone: "default" },
    top: { type: topType, material: football ? "performance fabric" : "heavyweight cotton", colour: primary, details: [...(topType === "hoodie" ? ["hood", "drawstrings", "kangaroo pocket"] : []), "finished seams", ...graphic] },
    bottom: { type: bottomType, material: football ? "performance fabric" : "cotton", colour: primary, details: ["waistband", "side seams", "natural folds", ...graphic] },
    footwear: { type: football ? "football boots" : "simple sneakers", colour: primary === "black" ? "black" : "white", details: ["coordinated accents"] },
    accessories: anime ? ["preview-only anime accent"] : [],
    completeLook: `coordinated ${primary} ${style} outfit`,
  };
}

