import { TEMPLATE_SIZE, TEMPLATE_ZONES } from "./templates";

/** Files that together make up one complete classic outfit. */
export type OutfitFiles = {
  shirt: string; // full 585x559 shirt template PNG
  pants?: string; // full 585x559 pants template PNG
  tshirt?: string; // square motif PNG (classic t-shirt)
};

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Pick the darkest palette color as pants base, and a brighter one as accent. */
export function pickPantsColors(palette: string[]): { base: string; accent: string } {
  const valid = palette.filter((c) => /^#?[0-9a-f]{6}$/i.test(c.trim()));
  if (valid.length === 0) return { base: "#1e293b", accent: "#64748b" };
  const sorted = [...valid].sort((a, b) => luminance(a) - luminance(b));
  const base = sorted[0];
  const accent = sorted[sorted.length - 1] === base ? "#e2e8f0" : sorted[sorted.length - 1];
  return { base, accent };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Render a Roblox classic pants template PNG that matches the outfit:
 * base color everywhere, an accent stripe down the outside of each leg,
 * and (optionally) a small version of the AI motif on the right leg.
 */
export async function renderPantsTexture(input: {
  base: string;
  accent: string;
  motifUrl?: string;
}): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = TEMPLATE_SIZE.width;
  canvas.height = TEMPLATE_SIZE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = input.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const zones = TEMPLATE_ZONES.pants;
  const legs = [zones.left_leg_front, zones.right_leg_front, zones.left_leg_back, zones.right_leg_back];

  // Accent stripe down the outer edge of each leg + waistband bar.
  ctx.fillStyle = input.accent;
  for (const leg of legs) {
    if (!leg) continue;
    const stripeW = 12;
    const outerLeft = leg.key.startsWith("left") ? leg.left : leg.left + leg.width - stripeW;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(outerLeft, leg.top, stripeW, leg.height);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(leg.left, leg.top, leg.width, 8);
    ctx.globalAlpha = 1;
  }

  // Small motif on the right leg front, if we have one.
  if (input.motifUrl) {
    const img = await loadImage(input.motifUrl);
    const leg = zones.right_leg_front;
    if (img && leg) {
      const size = Math.min(leg.width, leg.height) * 0.6;
      ctx.save();
      ctx.beginPath();
      ctx.rect(leg.left, leg.top, leg.width, leg.height);
      ctx.clip();
      ctx.drawImage(img, leg.left + (leg.width - size) / 2, leg.top + leg.height * 0.15, size, size);
      ctx.restore();
    }
  }

  return canvas.toDataURL("image/png");
}

/** Downscale the AI motif to a square PNG suitable as a classic t-shirt (and for storage). */
export async function renderTShirtTexture(motifUrl: string, size = 512): Promise<string | undefined> {
  const img = await loadImage(motifUrl);
  if (!img) return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.drawImage(img, 0, 0, size, size);
  return canvas.toDataURL("image/png");
}

/** Parse a stored pending outfit; accepts the legacy plain-data-URL format too. */
export function parsePendingOutfit(raw: string): OutfitFiles | null {
  if (raw.startsWith("data:")) return { shirt: raw };
  try {
    const parsed = JSON.parse(raw) as OutfitFiles;
    if (typeof parsed.shirt === "string" && parsed.shirt.startsWith("data:")) return parsed;
  } catch {
    /* fall through */
  }
  return null;
}
