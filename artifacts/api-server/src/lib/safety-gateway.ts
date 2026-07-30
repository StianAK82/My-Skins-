import { createHash } from "node:crypto";

// ============================================================================
// SafetyGateway — every child-written prompt passes through this BEFORE any
// AI provider call. Stages: rate limiting → length → PII → moderation
// (sexual / violence & self-harm / hate / drugs) → IP & brand protection →
// safe normalization. Raw child prompts are never stored or logged; callers
// get back a normalized safe form plus a hash + decision for auditing.
// ============================================================================

export type SafetyErrorCode =
  | "PROMPT_TOO_LONG"
  | "PII_DETECTED"
  | "SAFETY_BLOCKED"
  | "IP_RESTRICTED"
  | "RATE_LIMITED";

export type SafetyStage =
  | "rate_limit"
  | "length_validation"
  | "pii_detection"
  | "moderation"
  | "ip_protection";

/** Child-friendly Norwegian messages, sent to the client alongside the code. */
export const SAFETY_MESSAGES_NO: Record<SafetyErrorCode, string> = {
  PROMPT_TOO_LONG: "Oi, teksten ble litt for lang! Prøv å beskrive skinet ditt med færre ord. 😊",
  PII_DETECTED: "Ikke skriv navn, adresse eller telefonnummer her. Beskriv bare skinet du ønsker deg! 😊",
  SAFETY_BLOCKED: "Det der kan vi ikke lage. Prøv en annen idé – kanskje en kul drage eller en romhelt? 🐉",
  IP_RESTRICTED: "Vi kan ikke kopiere ekte merker og logoer, men vi kan lage din helt egen kule variant! Prøv å beskrive stilen i stedet.",
  RATE_LIMITED: "Oisann, det går litt fort! Vent et lite øyeblikk og prøv igjen. ⏳",
};

export class SafetyError extends Error {
  readonly code: SafetyErrorCode;
  readonly stage: SafetyStage;
  readonly httpStatus: number;
  readonly retryable: boolean;
  /** Which moderation/PII categories triggered — safe to log. */
  readonly categories: string[];

  constructor(code: SafetyErrorCode, stage: SafetyStage, options?: { categories?: string[] }) {
    super(SAFETY_MESSAGES_NO[code]);
    this.name = "SafetyError";
    this.code = code;
    this.stage = stage;
    this.categories = options?.categories ?? [];
    this.httpStatus = code === "RATE_LIMITED" ? 429 : 400;
    this.retryable = code === "RATE_LIMITED";
  }
}

export const MAX_PROMPT_LENGTH = 600;

// ---------------------------------------------------------------------------
// Stage: prompt length
// ---------------------------------------------------------------------------
export function checkPromptLength(prompt: string): void {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new SafetyError("PROMPT_TOO_LONG", "length_validation");
  }
}

// ---------------------------------------------------------------------------
// Stage: PII detection (names/addresses/contact info children might type)
// ---------------------------------------------------------------------------
const PII_PATTERNS: Array<{ category: string; pattern: RegExp }> = [
  { category: "email", pattern: /[\w.+-]+@[\w-]+\.[\w.]{2,}/i },
  // Norwegian national ID (11 digits) or long digit runs typical of IDs.
  { category: "national_id", pattern: /(?<!\d)\d{6}\s?\d{5}(?!\d)/ },
  // Phone numbers: +47 xx xx xx xx, 8 digits in a row or grouped.
  { category: "phone", pattern: /(?:\+\d{1,3}[\s-]?)?(?<!\d)(?:\d[\s-]?){8,}(?!\d)/ },
  // Street addresses: «Storgata 12», «Bjørkeveien 3B», «Main Street 42».
  {
    category: "address",
    pattern: /\b[\wæøåÆØÅ]+(?:gate|gata|gaten|vei|veien|vegen|allé|alle|plass|street|road|avenue)\s+\d+\s?[a-zA-Z]?\b/i,
  },
  // Norwegian postcode + place: «0155 Oslo».
  { category: "address", pattern: /(?<!\d)\d{4}\s+[A-ZÆØÅ][a-zæøå]{2,}(?!\d)/ },
  // Self-identification with full name: «jeg heter Ola Nordmann», «my name is …».
  {
    category: "name",
    pattern: /\b(?:jeg heter|mitt navn er|my name is|jag heter|jeg hedder)\s+\S+\s+\S+/i,
  },
  // «jeg bor i/på …» — children revealing where they live.
  { category: "address", pattern: /\b(?:jeg bor|i live at|jag bor|jeg boer)\b/i },
];

export function detectPii(prompt: string): string[] {
  const hits = new Set<string>();
  for (const { category, pattern } of PII_PATTERNS) {
    if (pattern.test(prompt)) hits.add(category);
  }
  return [...hits];
}

// ---------------------------------------------------------------------------
// Stage: child-safety moderation (sexual / violence & self-harm / hate / drugs)
// Word lists cover Norwegian, English and common Scandinavian variants.
// Matching is word-boundary based to avoid false hits inside harmless words.
// ---------------------------------------------------------------------------
const MODERATION_LISTS: Array<{ category: string; words: string[] }> = [
  {
    category: "sexual",
    words: [
      "sex", "sexy", "porno", "porn", "naken", "nakne", "nude", "naked",
      "penis", "vagina", "pupper", "boobs", "bryster uten", "erotisk", "erotic",
      "onani", "masturb", "stripper", "strip club", "horehus", "bordell",
    ],
  },
  {
    category: "self_harm",
    words: [
      "selvmord", "suicide", "kill myself", "drepe meg selv", "ta livet mitt",
      "kutte meg", "cut myself", "self harm", "selvskading", "henge meg",
    ],
  },
  {
    category: "violence",
    words: [
      "skyte skolen", "school shooting", "skoleskyting", "terrorist", "terror attack",
      "terrorangrep", "drepe deg", "kill you", "massakre", "massacre", "halshugge",
      "beheading", "tortur", "torture", "voldta", "rape", "isis", "bombe skolen",
    ],
  },
  {
    category: "hate",
    words: [
      "nazist", "nazi", "hitler", "heil", "hakekors", "swastika", "ku klux",
      "kkk drakt", "rasist", "racist", "white power", "jødehat", "neger",
    ],
  },
  {
    category: "drugs",
    words: [
      "kokain", "cocaine", "heroin", "meth", "amfetamin", "narkotika", "weed joint",
      "marihuana", "cannabis", "ecstasy", "mdma",
    ],
  },
];

function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}])${escaped}`, "iu").test(text);
}

export function moderatePrompt(prompt: string): string[] {
  const hits = new Set<string>();
  for (const { category, words } of MODERATION_LISTS) {
    for (const word of words) {
      if (containsWord(prompt, word)) {
        hits.add(category);
        break;
      }
    }
  }
  return [...hits];
}

// ---------------------------------------------------------------------------
// Stage: IP / brand / character protection.
// Protected CHARACTERS are rewritten into an original safe alternative that
// keeps the broad attributes (colors, theme) — «lag Spider-Man» becomes an
// original red-and-blue web-inspired hero. Protected BRAND LOGOS are blocked
// with IP_RESTRICTED, since a logo request is always a copy request.
// ---------------------------------------------------------------------------
type CharacterRule = { pattern: RegExp; replacement: string };

const PROTECTED_CHARACTERS: CharacterRule[] = [
  { pattern: /spider[\s-]?man+|spidermann?en/gi, replacement: "an original red-and-blue hero outfit with a web-inspired pattern (an original design, not the protected character)" },
  { pattern: /\bbatman\b/gi, replacement: "an original dark-grey and black bat-inspired hero outfit with a cape (an original design, not the protected character)" },
  { pattern: /\bsuperman\b/gi, replacement: "an original blue-and-red super hero outfit with a cape (an original design, not the protected character)" },
  { pattern: /\bhulk(?:en)?\b/gi, replacement: "an original giant green strong-hero look with torn purple shorts (an original design, not the protected character)" },
  { pattern: /iron[\s-]?man\b/gi, replacement: "an original red-and-gold armored robot-hero suit (an original design, not the protected character)" },
  { pattern: /captain\s+america|kaptein\s+amerika/gi, replacement: "an original star-themed red, white and blue hero outfit with a round shield motif (an original design, not the protected character)" },
  { pattern: /\belsa\b(?:\s+fra\s+frost|\s+from\s+frozen)?/gi, replacement: "an original ice-princess look with a light blue sparkling dress and snowflake details (an original design, not the protected character)" },
  { pattern: /\bpikachu\b/gi, replacement: "an original cute yellow electric-creature look with red cheeks and a lightning-bolt tail shape (an original design, not the protected character)" },
  { pattern: /\bpok[eé]mon\b/gi, replacement: "original cute fantasy pocket-creature designs (original designs, not the protected franchise)" },
  { pattern: /\b(?:super\s+)?mario\b/gi, replacement: "an original cheerful plumber-hero look with red cap and blue overalls (an original design, not the protected character)" },
  { pattern: /\bluigi\b/gi, replacement: "an original cheerful plumber-hero look with green cap and blue overalls (an original design, not the protected character)" },
  { pattern: /\bsonic\b/gi, replacement: "an original speedy blue hedgehog-inspired hero look with red shoes (an original design, not the protected character)" },
  { pattern: /\bminions?\b/gi, replacement: "an original funny little yellow helper-creature look with goggles and blue overalls (an original design, not the protected characters)" },
  { pattern: /harry\s+potter/gi, replacement: "an original young-wizard look with a dark school robe, round glasses and a scarf (an original design, not the protected character)" },
  { pattern: /darth\s+vader/gi, replacement: "an original black armored space-villain look with a dark helmet and cape (an original design, not the protected character)" },
  { pattern: /\bnaruto\b/gi, replacement: "an original orange ninja-hero outfit with a headband (an original design, not the protected character)" },
  { pattern: /\bgoku\b/gi, replacement: "an original orange martial-arts hero outfit with spiky hair (an original design, not the protected character)" },
  { pattern: /hello\s+kitty/gi, replacement: "an original cute white kitten character with a bow (an original design, not the protected character)" },
  { pattern: /\bbarbie\b/gi, replacement: "an original glamorous pink fashion-doll style outfit (an original design, not the protected brand)" },
  { pattern: /(?:teenage\s+mutant\s+)?ninja\s+turtles?|turtles\s+ninja/gi, replacement: "original green turtle-ninja hero looks with colored eye masks (original designs, not the protected characters)" },
  { pattern: /mi(?:ckey|kke)\s+m(?:ouse|us)/gi, replacement: "an original cheerful cartoon-mouse character with red shorts (an original design, not the protected character)" },
  { pattern: /spongebob|svampebob/gi, replacement: "an original funny yellow square sea-creature character (an original design, not the protected character)" },
  { pattern: /\bfortnite\b/gi, replacement: "an original colorful battle-game hero outfit (an original design, not the protected franchise)" },
  { pattern: /\bdeadpool\b/gi, replacement: "an original red-and-black masked hero outfit (an original design, not the protected character)" },
];

// Brand / logo requests are blocked outright.
const PROTECTED_BRANDS: RegExp[] = [
  /\bnike\b/i,
  /\badidas\b/i,
  /\bgucci\b/i,
  /\bsupreme\b/i,
  /louis\s+vuitton/i,
  /\bpuma\b/i,
  /\bbalenciaga\b/i,
  /\blacoste\b/i,
  /\bfila\b/i,
  /\bchanel\b/i,
];

export type IpCheckResult = {
  safePrompt: string;
  rewritten: boolean;
  categories: string[];
};

export function applyIpProtection(prompt: string): IpCheckResult {
  for (const brand of PROTECTED_BRANDS) {
    if (brand.test(prompt)) {
      throw new SafetyError("IP_RESTRICTED", "ip_protection", { categories: ["brand_logo"] });
    }
  }

  let safePrompt = prompt;
  let rewritten = false;
  for (const rule of PROTECTED_CHARACTERS) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(safePrompt)) {
      rule.pattern.lastIndex = 0;
      safePrompt = safePrompt.replace(rule.pattern, rule.replacement);
      rewritten = true;
    }
  }
  // When we rewrote, also strip «nøyaktig/exactly/kopier» copy-instructions so
  // the model doesn't try to reconstruct the protected design anyway.
  if (rewritten) {
    safePrompt = safePrompt.replace(/\b(nøyaktig|eksakt|identisk|kopier(?:e)?|exactly|identical|copy of|akkurat som)\b/gi, "");
  }
  return { safePrompt, rewritten, categories: rewritten ? ["protected_character"] : [] };
}

// ---------------------------------------------------------------------------
// Stage: rate limiting (sliding window per client IP)
// ---------------------------------------------------------------------------
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  check(key: string): void {
    const nowMs = this.now();
    const windowStart = nowMs - this.windowMs;
    const entries = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    if (entries.length >= this.maxRequests) {
      this.hits.set(key, entries);
      throw new SafetyError("RATE_LIMITED", "rate_limit");
    }
    entries.push(nowMs);
    this.hits.set(key, entries);
    // Opportunistic cleanup so the map doesn't grow unbounded.
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) {
        if (v.every((t) => t <= windowStart)) this.hits.delete(k);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Full evaluation + decision registry (data-minimized audit trail)
// ---------------------------------------------------------------------------
export type SafetyDecision = {
  /** sha256 of the ORIGINAL prompt — lets us match reports without storing text. */
  promptHash: string;
  /** sha256 of the normalized safe prompt actually sent to the provider. */
  safePromptHash: string;
  decision: "allowed" | "allowed_rewritten" | "blocked";
  code?: SafetyErrorCode;
  categories: string[];
  /** Normalized safe form (only stored form — never the raw prompt when rewritten). */
  safePrompt: string;
};

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt.trim().toLowerCase()).digest("hex");
}

/**
 * Runs all text stages on one prompt. Throws SafetyError on block; returns the
 * normalized safe prompt + decision on success.
 */
export function evaluatePrompt(rawPrompt: string): SafetyDecision {
  const promptHash = hashPrompt(rawPrompt);

  checkPromptLength(rawPrompt);

  const piiCategories = detectPii(rawPrompt);
  if (piiCategories.length > 0) {
    throw new SafetyError("PII_DETECTED", "pii_detection", { categories: piiCategories });
  }

  const moderationCategories = moderatePrompt(rawPrompt);
  if (moderationCategories.length > 0) {
    throw new SafetyError("SAFETY_BLOCKED", "moderation", { categories: moderationCategories });
  }

  const ipResult = applyIpProtection(rawPrompt);
  const safePrompt = ipResult.safePrompt.replace(/\s{2,}/g, " ").trim();

  return {
    promptHash,
    safePromptHash: hashPrompt(safePrompt),
    decision: ipResult.rewritten ? "allowed_rewritten" : "allowed",
    categories: ipResult.categories,
    safePrompt,
  };
}

// Small LRU-ish registry so the persistence layer can attach the gateway
// decision to a saved generation without re-running the checks.
const decisionRegistry = new Map<string, SafetyDecision>();
const DECISION_REGISTRY_MAX = 500;

export function recordDecision(decision: SafetyDecision): void {
  decisionRegistry.set(decision.safePromptHash, decision);
  if (decisionRegistry.size > DECISION_REGISTRY_MAX) {
    const oldest = decisionRegistry.keys().next().value;
    if (oldest !== undefined) decisionRegistry.delete(oldest);
  }
}

export function lookupDecision(safePromptOrHash: string): SafetyDecision | undefined {
  const key = safePromptOrHash.length === 64 && /^[0-9a-f]+$/.test(safePromptOrHash)
    ? safePromptOrHash
    : hashPrompt(safePromptOrHash);
  return decisionRegistry.get(key);
}
