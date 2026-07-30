import { createHash } from "crypto";
import { createCanvas, loadImage, type SKRSContext2D, type Image } from "@napi-rs/canvas";
import { REQUIRED_COVERAGE_ZONES, TEMPLATE_SIZE, TEMPLATE_ZONES, type TemplateType, type ZoneRect } from "./clothing-templates";

export const PIPELINE_VERSION = "classic-clothing/1";
export const COMPILER_VERSION = "compiler/1.0.0";

export type ArtifactClass = "ClassicTShirtArtifact" | "ClassicShirtArtifact" | "ClassicPantsArtifact";

export type LayerTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  visible?: boolean;
  locked?: boolean;
};

export type BrushPoint = { x: number; y: number; size: number; opacity: number; softness: number; erase?: boolean };

export type DesignLayer = {
  id?: string;
  name?: string;
  type: "imageLayer" | "textLayer" | "brushLayer" | "accessoryLayer" | "paintLayerSet" | "moduleLayer";
  zone: string;
  assetId?: string;
  assetCategory?: string;
  color?: string;
  image?: string;
  text?: string;
  fontSize?: number;
  points?: BrushPoint[];
  transform: LayerTransform;
};

export type DesignSpec = {
  template: TemplateType;
  baseColor?: string;
  layers: DesignLayer[];
};

export type ClothingSpec = {
  specId: string;
  type: TemplateType;
  design: DesignSpec;
};

export type CompiledArtifact = {
  specId: string;
  artifactClass: ArtifactClass;
  templateType: TemplateType;
  png: Buffer;
  sha256: string;
  mimeType: "image/png";
  width: number;
  height: number;
  byteSize: number;
};

export function artifactClassForTemplate(template: TemplateType): ArtifactClass {
  return template === "pants" ? "ClassicPantsArtifact" : "ClassicShirtArtifact";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function num(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeTransform(t: Partial<LayerTransform> | undefined): LayerTransform {
  return {
    x: clamp(num(t?.x, 0), -TEMPLATE_SIZE.width, TEMPLATE_SIZE.width),
    y: clamp(num(t?.y, 0), -TEMPLATE_SIZE.height, TEMPLATE_SIZE.height),
    scale: clamp(num(t?.scale, 1), 0.1, 4),
    rotation: clamp(num(t?.rotation, 0), -360, 360),
    opacity: clamp(num(t?.opacity, 1), 0, 1),
    visible: t?.visible !== false,
    locked: Boolean(t?.locked),
  };
}

// Mirrors the client renderer's export-target rules: preview-only layers are
// excluded from compiled Roblox artifacts.
function isExportableLayer(layer: DesignLayer): boolean {
  if (layer.type === "accessoryLayer") return false;
  if (layer.assetCategory === "hair" || layer.assetCategory === "accessory") return false;
  return true;
}

export function parseDesignSpec(canvasData: string | null | undefined, fallbackTemplate: TemplateType): DesignSpec {
  const base: DesignSpec = { template: fallbackTemplate, baseColor: "#0f172a", layers: [] };
  if (!canvasData) return base;
  try {
    const raw = JSON.parse(canvasData) as Record<string, unknown>;
    const state = (typeof raw === "object" && raw !== null && typeof (raw as { state?: unknown }).state === "object"
      ? (raw as { state: Record<string, unknown> }).state
      : raw) as Record<string, unknown>;
    const template: TemplateType = state.template === "pants" ? "pants" : state.template === "shirt" ? "shirt" : fallbackTemplate;
    const baseColor = typeof state.baseColor === "string" ? state.baseColor : base.baseColor;
    const layersRaw = Array.isArray(state.layers) ? state.layers : [];
    const layers: DesignLayer[] = [];
    for (const item of layersRaw) {
      if (typeof item !== "object" || item === null) continue;
      const layer = item as Record<string, unknown>;
      if (typeof layer.type !== "string" || typeof layer.zone !== "string") continue;
      layers.push({
        id: typeof layer.id === "string" ? layer.id : undefined,
        type: layer.type as DesignLayer["type"],
        zone: layer.zone,
        assetId: typeof layer.assetId === "string" ? layer.assetId : undefined,
        assetCategory: typeof layer.assetCategory === "string" ? layer.assetCategory : undefined,
        color: typeof layer.color === "string" ? layer.color : undefined,
        image: typeof layer.image === "string" ? layer.image : undefined,
        text: typeof layer.text === "string" ? layer.text : undefined,
        fontSize: typeof layer.fontSize === "number" ? layer.fontSize : undefined,
        points: Array.isArray(layer.points) ? (layer.points as BrushPoint[]) : undefined,
        transform: normalizeTransform(layer.transform as Partial<LayerTransform> | undefined),
      });
    }
    return { template, baseColor, layers };
  } catch {
    return base;
  }
}

function withZoneClip(ctx: SKRSContext2D, zone: ZoneRect, draw: () => void) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(zone.left, zone.top, zone.width, zone.height);
  ctx.clip();
  draw();
  ctx.restore();
}

function drawZoneColor(ctx: SKRSContext2D, template: TemplateType, layer: DesignLayer) {
  const zone = TEMPLATE_ZONES[template][layer.zone];
  if (!zone) return;
  ctx.save();
  ctx.globalAlpha = layer.transform.opacity;
  ctx.fillStyle = layer.color ?? "#64748b";
  ctx.fillRect(zone.left, zone.top, zone.width, zone.height);
  ctx.restore();
}

function drawText(ctx: SKRSContext2D, layer: DesignLayer) {
  if (!layer.text) return;
  ctx.save();
  ctx.globalAlpha = layer.transform.opacity;
  ctx.fillStyle = layer.color ?? "#ffffff";
  ctx.font = `${layer.fontSize ?? 24}px sans-serif`;
  ctx.translate(layer.transform.x, layer.transform.y);
  ctx.rotate((layer.transform.rotation * Math.PI) / 180);
  ctx.scale(layer.transform.scale, layer.transform.scale);
  ctx.fillText(layer.text, 0, 0);
  ctx.restore();
}

function drawBrush(ctx: SKRSContext2D, layer: DesignLayer) {
  if (!layer.points?.length) return;
  for (const point of layer.points) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
    ctx.save();
    ctx.globalAlpha = clamp(num(point.opacity, 1), 0, 1);
    ctx.globalCompositeOperation = point.erase ? "destination-out" : "source-over";
    const size = Math.max(1, num(point.size, 8));
    const softness = clamp(num(point.softness, 0.6), 0, 1);
    const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, size);
    gradient.addColorStop(0, layer.color ?? "#ef4444");
    gradient.addColorStop(softness, layer.color ?? "#ef4444");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function overlayBoxSize(zone: ZoneRect, layer: DesignLayer) {
  const category = layer.assetCategory ?? "graphic";
  if (category === "trim") return { width: zone.width * 0.96, height: zone.height * 0.24 };
  if (category === "patch") return { width: zone.width * 0.34, height: zone.height * 0.34 };
  if (category === "module") return { width: zone.width * 0.82, height: zone.height * 0.62 };
  const widthRatio = layer.type === "moduleLayer" ? 0.82 : 0.95;
  const heightRatio = layer.type === "moduleLayer" ? 0.62 : 0.95;
  return { width: zone.width * widthRatio, height: zone.height * heightRatio };
}

function fitIntoBox(source: { width: number; height: number } | null, box: { width: number; height: number }) {
  if (!source || !source.width || !source.height) return box;
  const sourceRatio = source.width / source.height;
  const boxRatio = box.width / box.height;
  if (sourceRatio > boxRatio) return { width: box.width, height: box.width / sourceRatio };
  return { width: box.height * sourceRatio, height: box.height };
}

function drawFallbackShape(ctx: SKRSContext2D, layer: DesignLayer, width: number, height: number) {
  const tint = layer.color ?? "#e2e8f0";
  const category = layer.assetCategory ?? "graphic";
  ctx.fillStyle = tint;
  ctx.strokeStyle = "rgba(15,23,42,0.9)";
  ctx.lineWidth = 2;

  if (category === "trim") {
    ctx.fillRect(-width / 2, -height * 0.15, width, height * 0.3);
    return;
  }
  if (category === "patch") {
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, 8);
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (category === "module") {
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(0, -height / 2);
  ctx.lineTo(width / 2, 0);
  ctx.lineTo(0, height / 2);
  ctx.lineTo(-width / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// SSRF guard: the compiler never fetches remote URLs. Only inline data URLs
// (how uploads and AI images are persisted in the design state) are decoded.
// Any http(s) or other reference in persisted design data is ignored.
export function isAllowedImageSource(src: string): boolean {
  return src.startsWith("data:image/");
}

async function loadLayerImage(src: string): Promise<Image | null> {
  try {
    if (!isAllowedImageSource(src)) return null;
    const base64 = src.split(",")[1] ?? "";
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
    return await loadImage(buffer);
  } catch {
    return null;
  }
}

function drawPatternOverlay(ctx: SKRSContext2D, zone: ZoneRect, layer: DesignLayer, image: Image | null) {
  const fallbackTileSize = Math.max(12, Math.round(Math.min(zone.width, zone.height) / 4));
  const baseTile = image ? Math.max(12, Math.round(Math.min(image.width, image.height))) : fallbackTileSize;
  const tileSize = Math.max(8, Math.round(baseTile * Math.max(layer.transform.scale, 0.1)));
  const centerX = zone.left + zone.width / 2 + layer.transform.x;
  const centerY = zone.top + zone.height / 2 + layer.transform.y;
  const drawRadius = Math.ceil(Math.sqrt(zone.width * zone.width + zone.height * zone.height) / 2) + tileSize * 2;

  withZoneClip(ctx, zone, () => {
    ctx.globalAlpha = layer.transform.opacity;
    ctx.translate(centerX, centerY);
    ctx.rotate((layer.transform.rotation * Math.PI) / 180);
    if (image) {
      const offsetX = ((layer.transform.x % tileSize) + tileSize) % tileSize;
      const offsetY = ((layer.transform.y % tileSize) + tileSize) % tileSize;
      for (let y = -drawRadius + offsetY; y <= drawRadius; y += tileSize) {
        for (let x = -drawRadius + offsetX; x <= drawRadius; x += tileSize) {
          ctx.drawImage(image, x - tileSize / 2, y - tileSize / 2, tileSize, tileSize);
        }
      }
      return;
    }
    const tint = layer.color ?? "#cbd5e1";
    for (let y = -drawRadius; y <= drawRadius; y += tileSize) {
      for (let x = -drawRadius; x <= drawRadius; x += tileSize) {
        ctx.fillStyle = tint;
        ctx.fillRect(x - tileSize / 2, y - tileSize / 2, tileSize * 0.5, tileSize * 0.5);
        ctx.fillRect(x, y, tileSize * 0.5, tileSize * 0.5);
        ctx.fillStyle = "rgba(15,23,42,0.2)";
        ctx.fillRect(x - tileSize * 0.3, y - tileSize * 0.3, tileSize * 0.6, tileSize * 0.1);
      }
    }
  });
}

async function drawOverlayLayer(ctx: SKRSContext2D, template: TemplateType, layer: DesignLayer) {
  const zone = TEMPLATE_ZONES[template][layer.zone];
  if (!zone) return;

  const src = layer.image ?? null;
  const image = src ? await loadLayerImage(src) : null;

  if (layer.assetCategory === "pattern") {
    drawPatternOverlay(ctx, zone, layer, image);
    return;
  }

  const box = overlayBoxSize(zone, layer);
  const { width, height } = fitIntoBox(image ? { width: image.width, height: image.height } : null, box);
  const centerX = zone.left + zone.width / 2 + layer.transform.x;
  const centerY = zone.top + zone.height / 2 + layer.transform.y;

  withZoneClip(ctx, zone, () => {
    ctx.globalAlpha = layer.transform.opacity;
    ctx.translate(centerX, centerY);
    ctx.rotate((layer.transform.rotation * Math.PI) / 180);
    ctx.scale(layer.transform.scale, layer.transform.scale);
    if (image) {
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
      return;
    }
    if (src) return; // image was requested but failed to load — skip, don't fake it
    drawFallbackShape(ctx, layer, width, height);
  });
}

export async function compileClassicClothing(spec: ClothingSpec): Promise<CompiledArtifact> {
  const { width, height } = TEMPLATE_SIZE;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = spec.design.baseColor ?? "#0f172a";
  ctx.fillRect(0, 0, width, height);

  for (const layer of spec.design.layers) {
    if (!isExportableLayer(layer)) continue;
    const normalized: DesignLayer = { ...layer, transform: normalizeTransform(layer.transform) };
    if (!normalized.transform.visible) continue;
    if (normalized.type === "paintLayerSet") drawZoneColor(ctx, spec.design.template, normalized);
    else if (normalized.type === "textLayer") drawText(ctx, normalized);
    else if (normalized.type === "brushLayer") drawBrush(ctx, normalized);
    else if (normalized.type === "imageLayer" || normalized.type === "moduleLayer") {
      await drawOverlayLayer(ctx, spec.design.template, normalized);
    }
  }

  const png = canvas.toBuffer("image/png");
  const sha256 = createHash("sha256").update(png).digest("hex");

  return {
    specId: spec.specId,
    artifactClass: artifactClassForTemplate(spec.type),
    templateType: spec.type,
    png,
    sha256,
    mimeType: "image/png",
    width,
    height,
    byteSize: png.length,
  };
}

// Derive required artifacts from a validated export plan — no global
// assumptions such as "every outfit needs shirt and pants".
export async function compileExportPlan(specs: ClothingSpec[]): Promise<CompiledArtifact[]> {
  const artifacts: CompiledArtifact[] = [];
  for (const spec of specs) {
    artifacts.push(await compileClassicClothing(spec));
  }
  return artifacts;
}

export { REQUIRED_COVERAGE_ZONES };
