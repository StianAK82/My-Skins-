import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { editImageBuffers } from "@workspace/integrations-openai-ai-server";

export type ClassicGarment = "shirt" | "pants";
export const CLASSIC_TEXTURE_SIZE = { width: 585, height: 559 } as const;

type Region = { name: string; x: number; y: number; width: number; height: number };
import { enhanceGarmentPrompt, formatEnhancedPrompt, type EnhancedGarmentSpecification } from "./classic-prompt-enhancer";

export const CLASSIC_REGIONS: Record<ClassicGarment, Region[]> = {
  shirt: [
    { name: "left sleeve", x: 44, y: 74, width: 128, height: 172 },
    { name: "torso front", x: 196, y: 74, width: 128, height: 172 },
    { name: "torso back", x: 338, y: 74, width: 128, height: 172 },
    { name: "right sleeve", x: 441, y: 74, width: 128, height: 172 },
  ],
  pants: [
    { name: "left hip", x: 44, y: 74, width: 128, height: 172 },
    { name: "waist front", x: 196, y: 74, width: 128, height: 172 },
    { name: "waist back", x: 338, y: 74, width: 128, height: 172 },
    { name: "right hip", x: 441, y: 74, width: 128, height: 172 },
    { name: "left leg", x: 44, y: 288, width: 128, height: 192 },
    { name: "right leg front", x: 196, y: 288, width: 128, height: 192 },
    { name: "left leg back", x: 338, y: 288, width: 128, height: 192 },
    { name: "right leg back", x: 441, y: 288, width: 128, height: 192 },
  ],
};


function crc32(input: Buffer): number { let crc = 0xffffffff; for (const byte of input) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Buffer): Buffer { const name = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data]))); return Buffer.concat([length, name, data, crc]); }
function encodeRgba(width: number, height: number, rgba: Buffer): Buffer { const rows = Buffer.alloc((width * 4 + 1) * height); for (let y = 0; y < height; y++) rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4); const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]); }

function decodePng(png: Buffer): { width: number; height: number; rgba: Buffer } {
  if (!png.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) throw new Error("image does not decode as PNG");
  let offset = 8, width = 0, height = 0, colorType = 0, bitDepth = 0; const idat: Buffer[] = [];
  while (offset + 12 <= png.length) { const length = png.readUInt32BE(offset); const type = png.toString("ascii", offset + 4, offset + 8); const data = png.subarray(offset + 8, offset + 8 + length); if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; } if (type === "IDAT") idat.push(data); offset += 12 + length; }
  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType)) throw new Error("unsupported PNG encoding");
  const channels = colorType === 6 ? 4 : 3, stride = width * channels, raw = inflateSync(Buffer.concat(idat)), recon = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) { const filter = raw[y * (stride + 1)]; for (let x = 0; x < stride; x++) { const value = raw[y * (stride + 1) + 1 + x], left = x >= channels ? recon[y * stride + x - channels] : 0, up = y ? recon[(y - 1) * stride + x] : 0, ul = y && x >= channels ? recon[(y - 1) * stride + x - channels] : 0; const p = left + up - ul, pa = Math.abs(p-left), pb = Math.abs(p-up), pc = Math.abs(p-ul); const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul; recon[y * stride + x] = (value + (filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left+up)/2) : filter === 4 ? predictor : 0)) & 255; } }
  const rgba = Buffer.alloc(width * height * 4); for (let i = 0, j = 0; i < recon.length; i += channels, j += 4) { rgba[j]=recon[i]; rgba[j+1]=recon[i+1]; rgba[j+2]=recon[i+2]; rgba[j+3]=channels===4?recon[i+3]:255; } return { width, height, rgba };
}

function resizeToAtlas(png: Buffer) { const decoded = decodePng(png); const out = Buffer.alloc(CLASSIC_TEXTURE_SIZE.width * CLASSIC_TEXTURE_SIZE.height * 4); for (let y=0;y<CLASSIC_TEXTURE_SIZE.height;y++) for(let x=0;x<CLASSIC_TEXTURE_SIZE.width;x++){ const sx=Math.min(decoded.width-1,Math.floor(x*decoded.width/CLASSIC_TEXTURE_SIZE.width)), sy=Math.min(decoded.height-1,Math.floor(y*decoded.height/CLASSIC_TEXTURE_SIZE.height)); decoded.rgba.copy(out,(y*CLASSIC_TEXTURE_SIZE.width+x)*4,(sy*decoded.width+sx)*4,(sy*decoded.width+sx)*4+4); } return encodeRgba(CLASSIC_TEXTURE_SIZE.width,CLASSIC_TEXTURE_SIZE.height,out); }

function referencePng(type: ClassicGarment, guide: boolean): Buffer { const {width,height}=CLASSIC_TEXTURE_SIZE, pixels=Buffer.alloc(width*height*4); for(let y=0;y<height;y++)for(let x=0;x<width;x++){const region=CLASSIC_REGIONS[type].find(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);if(!region)continue;const i=CLASSIC_REGIONS[type].indexOf(region),o=(y*width+x)*4,colors=[[67,97,238],[20,184,166],[168,85,247],[245,158,11]],c=colors[i%4];pixels[o]=guide?c[0]:238;pixels[o+1]=guide?c[1]:238;pixels[o+2]=guide?c[2]:238;pixels[o+3]=guide?72:255;} return encodeRgba(width,height,pixels); }

export function buildClassicTexturePrompt(type: ClassicGarment, description: string, enhanced = enhanceGarmentPrompt(type, description), correction?: string, hasReferences=false): string {
  return ["Edit Image 1 using Image 2 only as the UV region guide. Output one complete flat 585 x 559 Roblox Classic clothing UV texture.", `ORIGINAL USER DESCRIPTION (do not replace it): ${description}`, `ENHANCED GARMENT SPECIFICATION: ${formatEnhancedPrompt(enhanced)}`, `GARMENT TYPE: Classic ${type}. REQUIRED UV REGIONS: ${CLASSIC_REGIONS[type].map(r=>r.name).join(", ")}. Fill each distinct region in its exact atlas position and orientation.`,
    "REALISTIC CLOTHING TEXTURE: render appropriate fabric weave, denim grain, knit texture or leather grain; believable stitching, seams, folds, wrinkles, collars, cuffs, waistbands, pockets, zippers, buttons, panel construction, subtle highlights and structural shadows. Continue construction coherently between adjacent surfaces.",
    "NOT ALLOWED: human body, mannequin, floating garment, fashion photograph, catalogue image, 3D product render, repeated front image on the back, identical copied regions, copied squares, placeholders, guide colours, labels, template text, watermark, or unrelated background. Preserve transparency outside garment islands.",
    enhanced.visibleText ? `TEXT REQUIREMENT: render only ${enhanced.visibleText}, preserving exact spelling and placement. Add no other words or numbers.` : "TEXT REQUIREMENT: no visible letters, words, numbers, logos, or brand names anywhere.",
    hasReferences ? "Use the additional images only as references for visual quality, fabric detail and believable garment construction. Do not copy their colours, graphics, text, logos or exact design." : "",
    correction ? `CORRECTION AFTER FAILED VALIDATION: ${correction} Regenerate genuine garment artwork; do not return copied squares or placeholders.` : "", "Return only the PNG atlas."].filter(Boolean).join("\n");
}

export function validateClassicTexture(type: ClassicGarment, png: Buffer, blank=referencePng(type,false)): string[] { const failures:string[]=[]; let image; try { image=decodePng(png); } catch { return ["image must decode successfully as a PNG"]; } if(image.width!==585||image.height!==559) failures.push("output dimensions must be exactly 585 x 559"); if(png.equals(blank)) failures.push("output is byte-identical to the blank template"); const colors=new Map<string,number>(); for(let i=0;i<image.rgba.length;i+=4){if(image.rgba[i+3]>16){const key=`${image.rgba[i]>>4},${image.rgba[i+1]>>4},${image.rgba[i+2]>>4}`;colors.set(key,(colors.get(key)??0)+1);}} if(Math.max(0,...colors.values())>image.width*image.height*.9) failures.push("output is almost entirely one flat colour"); const guide=[[67,97,238],[20,184,166],[168,85,247],[245,158,11]]; let guidePixels=0; for(const r of CLASSIC_REGIONS[type]){let covered=0, varied=new Set<string>();for(let y=r.y;y<r.y+r.height;y+=3)for(let x=r.x;x<r.x+r.width;x+=3){const o=(y*image.width+x)*4;if(image.rgba[o+3]>32)covered++;varied.add(`${image.rgba[o]>>4},${image.rgba[o+1]>>4},${image.rgba[o+2]>>4}`);if(guide.some(c=>Math.abs(image.rgba[o]-c[0])<8&&Math.abs(image.rgba[o+1]-c[1])<8&&Math.abs(image.rgba[o+2]-c[2])<8))guidePixels++;} const samples=Math.ceil(r.width/3)*Math.ceil(r.height/3);if(covered/samples<.55)failures.push(`${r.name} has insufficient non-transparent coverage`);if(varied.size<3)failures.push(`${r.name} appears blank or flat`);} if(guidePixels>250)failures.push("coloured region-guide pixels remain visible"); return failures; }

async function qualityReferences(type: ClassicGarment) { const configured=process.env.AI_QUALITY_REFERENCES_DIR; const roots=[configured, resolve(process.cwd(),"assets/ai-references"),resolve(process.cwd(),"artifacts/api-server/assets/ai-references")].filter(Boolean) as string[]; for(const root of roots){try{const dir=resolve(root,type),names=(await readdir(dir)).filter(n=>n.toLowerCase().endsWith(".png")).sort().slice(0,3);if(names.length)return Promise.all(names.map(async filename=>({data:await readFile(resolve(dir,filename)),filename:`quality-${type}-${filename}`})));}catch{ /* Optional by design. */ }} return []; }

export async function generateClassicTexture(type: ClassicGarment, description: string) { const blank=referencePng(type,false),guide=referencePng(type,true),enhanced=enhanceGarmentPrompt(type,description),references=await qualityReferences(type); let raw: Buffer<ArrayBufferLike>=Buffer.alloc(0),final: Buffer<ArrayBufferLike>=Buffer.alloc(0),prompt="",failures:string[]=[]; let attempts=0; for(attempts=1;attempts<=2;attempts++){prompt=buildClassicTexturePrompt(type,description,enhanced,failures.join("; ")||undefined,references.length>0);raw=await editImageBuffers([{data:blank,filename:`blank-classic-${type}-585x559.png`},{data:guide,filename:`classic-${type}-region-guide-585x559.png`},...references],prompt);try{final=resizeToAtlas(raw);failures=validateClassicTexture(type,final,blank);}catch(error){failures=[error instanceof Error?error.message:"image decoding failed"];}if(!failures.length)break;} if(failures.length)throw new Error(`Image edit failed quality validation: ${failures.join("; ")}`); return {imageUrl:`data:image/png;base64,${final.toString("base64")}`,referenceUrl:`data:image/png;base64,${blank.toString("base64")}`,prompt,enhancedPrompt:formatEnhancedPrompt(enhanced),enhancedSpecification:enhanced,model:"gpt-image-1",requestMode:"images.edit",sourceSize:"1536x1024",finalSize:CLASSIC_TEXTURE_SIZE,attempts,qualityReferenceCount:references.length,sha256:createHash("sha256").update(final).digest("hex")}; }
