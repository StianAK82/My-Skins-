import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { editImageBuffers } from "@workspace/integrations-openai-ai-server";

export type ClassicGarment = "shirt" | "pants";
export const CLASSIC_TEXTURE_SIZE = { width: 585, height: 559 } as const;

type Region = { name: string; x: number; y: number; width: number; height: number };

// Major official atlas islands. Shirt deliberately has no leg regions; pants
// deliberately uses hip/leg terminology rather than the legacy sleeve names.
export const CLASSIC_REGIONS: Record<ClassicGarment, Region[]> = {
  shirt: [
    { name: "left arm surfaces", x: 44, y: 74, width: 128, height: 172 },
    { name: "torso front", x: 196, y: 74, width: 128, height: 172 },
    { name: "torso back", x: 338, y: 74, width: 128, height: 172 },
    { name: "right arm surfaces", x: 441, y: 74, width: 128, height: 172 },
  ],
  pants: [
    { name: "left hip surfaces", x: 44, y: 74, width: 128, height: 172 },
    { name: "waist front", x: 196, y: 74, width: 128, height: 172 },
    { name: "waist back", x: 338, y: 74, width: 128, height: 172 },
    { name: "right hip surfaces", x: 441, y: 74, width: 128, height: 172 },
    { name: "left leg surfaces", x: 44, y: 288, width: 128, height: 192 },
    { name: "right leg front surfaces", x: 196, y: 288, width: 128, height: 192 },
    { name: "left leg back surfaces", x: 338, y: 288, width: 128, height: 192 },
    { name: "right leg back surfaces", x: 441, y: 288, width: 128, height: 192 },
  ],
};

function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function referencePng(type: ClassicGarment, guide: boolean): Buffer {
  const { width, height } = CLASSIC_TEXTURE_SIZE;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    for (let x = 0; x < width; x += 1) {
      const region = CLASSIC_REGIONS[type].find((item) => x >= item.x && x < item.x + item.width && y >= item.y && y < item.y + item.height);
      const offset = row + 1 + x * 4;
      if (!region) continue;
      const index = CLASSIC_REGIONS[type].indexOf(region);
      const border = x - region.x < 2 || region.x + region.width - x <= 2 || y - region.y < 2 || region.y + region.height - y <= 2;
      const colors = [[67, 97, 238], [20, 184, 166], [168, 85, 247], [245, 158, 11]];
      const color = colors[index % colors.length];
      pixels[offset] = guide ? color[0] : 238;
      pixels[offset + 1] = guide ? color[1] : 238;
      pixels[offset + 2] = guide ? color[2] : 238;
      pixels[offset + 3] = guide ? (border ? 255 : 72) : 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(pixels, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

export function buildClassicTexturePrompt(type: ClassicGarment, description: string, corrective = false): string {
  const part = type === "shirt" ? "torso front, torso back, left arm and right arm surfaces" : "waist/hips and every front, back and side surface of both legs";
  return [
    "Edit Image 1 using Image 2 only as a region guide. Create one flat production-ready Roblox Classic clothing UV texture, not a product photograph.",
    `Garment type: Classic ${type === "shirt" ? "Shirt" : "Pants"}. User description: ${description}`,
    `Fill every supplied garment island: ${part}. Keep the exact supplied atlas layout and orientation.`,
    "Make it resemble believable constructed clothing: coherent fabric surface variation, panels, seams, stitching, folds, structural shadows, subtle highlights, and appropriate pockets, collar/hood/cuffs/waistband/zippers/buttons.",
    "Construction, material and colours must continue coherently across front, back, sides, and sleeves or legs. Draw all details directly into their correct UV regions.",
    "Do not paste or repeat the same image in different regions. Give front and back their correct distinct construction. Do not leave any required region blank.",
    "Return only the complete flat texture. No person, body, avatar, mannequin, hanger, floating garment, 3D render, background scene, label, guide text, diagnostic colour, border, watermark, or instructions.",
    "Remove all coloured guide marks from Image 2. Preserve transparent pixels outside the garment islands. PNG output only.",
    corrective ? "CORRECTION: the prior result failed structural validation. Strictly preserve the UV atlas, cover every island, and remove every guide/label or human figure." : "",
  ].filter(Boolean).join("\n");
}

function isPng(buffer: Buffer) {
  return buffer.length > 10_000 && buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
}

export async function generateClassicTexture(type: ClassicGarment, description: string) {
  const blank = referencePng(type, false);
  const guide = referencePng(type, true);
  let raw: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let prompt = "";
  let attempts = 0;
  for (attempts = 1; attempts <= 2; attempts += 1) {
    prompt = buildClassicTexturePrompt(type, description, attempts === 2);
    raw = await editImageBuffers([
      { data: blank, filename: `blank-classic-${type}-585x559.png` },
      { data: guide, filename: `classic-${type}-region-guide-585x559.png` },
    ], prompt);
    if (isPng(raw)) break;
  }
  if (!isPng(raw)) throw new Error("Image edit returned an invalid or blank PNG");
  return {
    imageUrl: `data:image/png;base64,${raw.toString("base64")}`,
    referenceUrl: `data:image/png;base64,${blank.toString("base64")}`,
    prompt,
    model: "gpt-image-1",
    requestMode: "images.edit",
    sourceSize: "1536x1024",
    finalSize: CLASSIC_TEXTURE_SIZE,
    attempts,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}
