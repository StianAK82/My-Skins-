import type { z } from "zod";
import type { aiOutfitSchema } from "./ai-contracts";

export type OutfitForFaithfulness = z.infer<typeof aiOutfitSchema>;

export type FaithfulnessReport = {
  ok: boolean;
  score: number;
  requirements: string[];
  issues: string[];
};

type Requirement = {
  id: string;
  matches: (outfit: OutfitForFaithfulness) => boolean;
  correction: string;
};

const hasAccessory = (
  outfit: OutfitForFaithfulness,
  ...kinds: OutfitForFaithfulness["accessories"][number]["kind"][]
) => outfit.accessories.some((accessory) => kinds.includes(accessory.kind));

function requestedRequirements(prompt: string): Requirement[] {
  const text = prompt.toLocaleLowerCase("nb-NO");
  const requirements: Requirement[] = [];
  const add = (requirement: Requirement) => {
    if (!requirements.some((entry) => entry.id === requirement.id))
      requirements.push(requirement);
  };

  if (
    /hette\s*genser|hettegenser|hoodie|hooded\s+sweater|luvtr[oö]ja/u.test(text)
  ) {
    add({
      id: "hoodie",
      matches: (o) => o.top === "hoodie",
      correction: 'set outfit.top to "hoodie"',
    });
  }
  if (/\b(jakke|jacket|coat|frakk|vinterjakke|vinterfrakk)\b/u.test(text)) {
    add({
      id: "jacket",
      matches: (o) => o.top === "jacket",
      correction: 'set outfit.top to "jacket"',
    });
  }
  if (
    /\b(kjole|gown|dress)\b/u.test(text) &&
    !/\b(fotballdrakt|football kit|ninja outfit)\b/u.test(text)
  ) {
    add({
      id: "dress",
      matches: (o) => o.top === "dress",
      correction: 'set outfit.top to "dress"',
    });
  }
  if (/\b(jeans|olabukse|bukse|bukser|pants|trousers)\b/u.test(text)) {
    add({
      id: "pants",
      matches: (o) => o.bottom === "pants",
      correction: 'set outfit.bottom to "pants"',
    });
  }
  if (
    /\b(shorts|kortbukse)\b/u.test(text) ||
    /fotballdrakt|football kit/u.test(text)
  ) {
    add({
      id: "shorts",
      matches: (o) => o.bottom === "shorts",
      correction: 'set outfit.bottom to "shorts"',
    });
  }
  if (
    /\b(sko|skoene|shoes|sneakers|joggesko|snikkers|boots|st[oø]vler)\b/u.test(
      text,
    )
  ) {
    const wantsBoots = /boots|st[oø]vler/u.test(text);
    add({
      id: wantsBoots ? "boots" : "shoes",
      matches: (o) => (wantsBoots ? o.shoes === "boots" : o.shoes !== "none"),
      correction: wantsBoots
        ? 'set outfit.shoes to "boots"'
        : 'set outfit.shoes to "sneakers"',
    });
  }
  if (/\b(h[aå]r|hair|frisyre)\b/u.test(text)) {
    add({
      id: "hair",
      matches: (o) => o.hair.style !== "none",
      correction: "choose the requested non-none hair style and color",
    });
  }

  const accessoryRules: Array<
    [RegExp, string, OutfitForFaithfulness["accessories"][number]["kind"][]]
  > = [
    [/\b(caps|cap|kaps)\b/u, "cap", ["cap"]],
    [/\b(lue|beanie|wool hat|ullue)\b/u, "beanie", ["beanie"]],
    [/\b(ryggsekk|backpack|sekk)\b/u, "backpack", ["backpack"]],
    [/\b(vinger|wings|angel wings)\b/u, "wings", ["wings"]],
    [/\b(krone|crown|tiara)\b/u, "crown", ["crown"]],
    [/\b(maske|mask)\b/u, "mask", ["mask"]],
    [/\b(belte|belt)\b/u, "belt", ["belt"]],
    [/\b(skulderveske|shoulder bag|veske|handbag)\b/u, "bag", ["bag"]],
  ];
  for (const [pattern, id, kinds] of accessoryRules) {
    if (pattern.test(text)) {
      add({
        id,
        matches: (o) => hasAccessory(o, ...kinds),
        correction: `include ${id} in outfit.accessories`,
      });
    }
  }
  if (
    /\b(stor|store|large|big)\w*\s+(?:hvite?\s+)?(?:engel\s*)?(vinger|wings)\b/u.test(
      text,
    )
  ) {
    add({
      id: "large-wings",
      matches: (o) =>
        o.accessories.some(
          (accessory) =>
            accessory.kind === "wings" && accessory.size === "large",
        ),
      correction: 'set the wings accessory size to "large"',
    });
  }

  if (/\b(ninja)\b/u.test(text)) {
    add({
      id: "ninja-top",
      matches: (o) => o.top !== "none",
      correction: "include a black ninja top",
    });
    add({
      id: "ninja-bottom",
      matches: (o) => o.bottom !== "none",
      correction: "include black ninja trousers",
    });
    add({
      id: "ninja-mask",
      matches: (o) => hasAccessory(o, "mask"),
      correction: "include a black mask",
    });
  }
  if (/\b(fotballdrakt|football kit|soccer kit)\b/u.test(text)) {
    add({
      id: "football-shirt",
      matches: (o) => o.top === "tshirt",
      correction: 'set outfit.top to "tshirt"',
    });
    add({
      id: "football-shoes",
      matches: (o) => o.shoes !== "none",
      correction: "include football shoes",
    });
  }
  if (/\b(sokker|socks)\b/u.test(text)) {
    add({
      id: "socks-disclosed",
      matches: (o) => o.unsupported.some((item) => /sokk|sock/i.test(item)),
      correction:
        "list socks in outfit.unsupported because the current preview has no socks category",
    });
  }

  return requirements;
}

export function evaluateOutfitFaithfulness(
  prompt: string,
  outfit: OutfitForFaithfulness,
): FaithfulnessReport {
  const requirements = requestedRequirements(prompt);
  const failed = requirements.filter(
    (requirement) => !requirement.matches(outfit),
  );
  return {
    ok: failed.length === 0,
    score:
      requirements.length === 0
        ? 1
        : (requirements.length - failed.length) / requirements.length,
    requirements: requirements.map((requirement) => requirement.id),
    issues: failed.map((requirement) => requirement.correction),
  };
}

export function buildFaithfulnessCorrection(
  report: FaithfulnessReport,
): string {
  return [
    "Your previous outfit did not faithfully include every item the child requested.",
    "Return the complete JSON again and correct every issue below without adding unrequested items:",
    ...report.issues.map((issue) => `- ${issue}`),
  ].join("\n");
}
