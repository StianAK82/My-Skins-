import { deflateSync, inflateSync } from "node:zlib";

export type ClassicGarment = "shirt" | "pants";
export const CLASSIC_TEXTURE_SIZE = { width: 585, height: 559 } as const;
export type ClassicRegion = { name: string; x: number; y: number; width: number; height: number };

/**
 * The 585x559 Roblox Classic UV islands.  Keep faces separate: their names are
 * also part of the image-editing contract and the preview/debug tooling.
 */
export const CLASSIC_REGIONS: Record<ClassicGarment, ClassicRegion[]> = {
  shirt: [
    { name: "right_arm_top", x: 44, y: 74, width: 64, height: 44 },
    { name: "right_arm_bottom", x: 108, y: 74, width: 64, height: 44 },
    { name: "right_arm_right", x: 44, y: 118, width: 32, height: 128 },
    { name: "right_arm_front", x: 76, y: 118, width: 32, height: 128 },
    { name: "right_arm_left", x: 108, y: 118, width: 32, height: 128 },
    { name: "right_arm_back", x: 140, y: 118, width: 32, height: 128 },
    { name: "torso_top", x: 196, y: 74, width: 64, height: 44 },
    { name: "torso_bottom", x: 260, y: 74, width: 64, height: 44 },
    { name: "torso_front", x: 196, y: 118, width: 128, height: 128 },
    { name: "torso_back", x: 338, y: 118, width: 128, height: 128 },
    { name: "torso_right", x: 324, y: 118, width: 14, height: 128 },
    { name: "torso_left", x: 466, y: 118, width: 14, height: 128 },
    { name: "left_arm_top", x: 441, y: 74, width: 64, height: 44 },
    { name: "left_arm_bottom", x: 505, y: 74, width: 64, height: 44 },
    { name: "left_arm_right", x: 441, y: 288, width: 32, height: 128 },
    { name: "left_arm_front", x: 473, y: 288, width: 32, height: 128 },
    { name: "left_arm_left", x: 505, y: 288, width: 32, height: 128 },
    { name: "left_arm_back", x: 537, y: 288, width: 32, height: 128 },
  ],
  pants: [
    { name: "left_hip", x: 44, y: 74, width: 128, height: 172 },
    { name: "waist_front", x: 196, y: 74, width: 128, height: 172 },
    { name: "waist_back", x: 338, y: 74, width: 128, height: 172 },
    { name: "right_hip", x: 441, y: 74, width: 128, height: 172 },
    { name: "left_leg", x: 44, y: 288, width: 128, height: 192 },
    { name: "right_leg_front", x: 196, y: 288, width: 128, height: 192 },
    { name: "left_leg_back", x: 338, y: 288, width: 128, height: 192 },
    { name: "right_leg_back", x: 441, y: 288, width: 128, height: 192 },
  ],
};

function crc32(input: Buffer): number { let crc = 0xffffffff; for (const byte of input) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Buffer): Buffer { const name = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data]))); return Buffer.concat([length, name, data, crc]); }
export function encodeRgba(width: number, height: number, rgba: Buffer): Buffer { const rows = Buffer.alloc((width * 4 + 1) * height); for (let y = 0; y < height; y++) rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4); const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]); }

export function decodePng(png: Buffer): { width: number; height: number; rgba: Buffer } {
  if (!png.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) throw new Error("image does not decode as PNG");
  let offset = 8, width = 0, height = 0, colorType = 0, bitDepth = 0; const idat: Buffer[] = [];
  while (offset + 12 <= png.length) { const length = png.readUInt32BE(offset); const type = png.toString("ascii", offset + 4, offset + 8); const data = png.subarray(offset + 8, offset + 8 + length); if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; } if (type === "IDAT") idat.push(data); offset += 12 + length; }
  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType)) throw new Error("unsupported PNG encoding");
  const channels = colorType === 6 ? 4 : 3, stride = width * channels, raw = inflateSync(Buffer.concat(idat)), recon = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) { const filter = raw[y * (stride + 1)]; for (let x = 0; x < stride; x++) { const value = raw[y * (stride + 1) + 1 + x], left = x >= channels ? recon[y * stride + x - channels] : 0, up = y ? recon[(y - 1) * stride + x] : 0, ul = y && x >= channels ? recon[(y - 1) * stride + x - channels] : 0; const p = left + up - ul, pa = Math.abs(p-left), pb = Math.abs(p-up), pc = Math.abs(p-ul); const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul; recon[y * stride + x] = (value + (filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left+up)/2) : filter === 4 ? predictor : 0)) & 255; } }
  const rgba = Buffer.alloc(width * height * 4); for (let i = 0, j = 0; i < recon.length; i += channels, j += 4) { rgba[j]=recon[i]; rgba[j+1]=recon[i+1]; rgba[j+2]=recon[i+2]; rgba[j+3]=channels===4?recon[i+3]:255; } return { width, height, rgba };
}

function lanczos(value: number, radius = 3): number { const distance = Math.abs(value); if (distance === 0) return 1; if (distance >= radius) return 0; const piDistance = Math.PI * distance; return radius * Math.sin(piDistance) * Math.sin(piDistance / radius) / (piDistance * piDistance); }

/** Finalize the model PNG in one alpha-safe, Lanczos-filtered resize. */
export function resizeToAtlas(png: Buffer): Buffer {
  const source = decodePng(png); const { width, height } = CLASSIC_TEXTURE_SIZE;
  if (source.width === width && source.height === height) return encodeRgba(width, height, source.rgba);
  const output = Buffer.alloc(width * height * 4), scaleX = source.width / width, scaleY = source.height / height;
  for (let y = 0; y < height; y += 1) { const sourceY = (y + 0.5) * scaleY - 0.5; for (let x = 0; x < width; x += 1) { const sourceX = (x + 0.5) * scaleX - 0.5, sums = [0, 0, 0, 0]; let totalWeight = 0;
    for (let sy = Math.floor(sourceY) - 2; sy <= Math.floor(sourceY) + 3; sy += 1) { if (sy < 0 || sy >= source.height) continue; const weightY = lanczos(sourceY - sy); for (let sx = Math.floor(sourceX) - 2; sx <= Math.floor(sourceX) + 3; sx += 1) { if (sx < 0 || sx >= source.width) continue; const weight = weightY * lanczos(sourceX - sx), offset = (sy * source.width + sx) * 4, alpha = source.rgba[offset + 3] / 255; sums[0] += source.rgba[offset] * alpha * weight; sums[1] += source.rgba[offset + 1] * alpha * weight; sums[2] += source.rgba[offset + 2] * alpha * weight; sums[3] += source.rgba[offset + 3] * weight; totalWeight += weight; } }
    const offset = (y * width + x) * 4, alpha = Math.max(0, Math.min(255, Math.round(sums[3] / totalWeight))), premultiplier = sums[3] / 255;
    output[offset] = premultiplier ? Math.max(0, Math.min(255, Math.round(sums[0] / premultiplier))) : 0; output[offset + 1] = premultiplier ? Math.max(0, Math.min(255, Math.round(sums[1] / premultiplier))) : 0; output[offset + 2] = premultiplier ? Math.max(0, Math.min(255, Math.round(sums[2] / premultiplier))) : 0; output[offset + 3] = alpha;
  } }
  return encodeRgba(width, height, output);
}
