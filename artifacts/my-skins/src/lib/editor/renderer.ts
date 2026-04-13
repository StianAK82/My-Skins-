import type { DesignLayer, DesignState } from "./design-state.ts";
import { TEMPLATE_SIZE, TEMPLATE_ZONES, type ZoneRect } from "./templates.ts";

type ImageCacheEntry = { status: "loading" | "loaded" | "error"; image: CanvasImageSource | null };

const overlayImageCache = new Map<string, ImageCacheEntry>();

function isPatternLayer(layer: DesignLayer) {
  return layer.assetCategory === "pattern";
}

function getOverlayImage(layer: DesignLayer): CanvasImageSource | null {
  if (!layer.image) return null;
  const cached = overlayImageCache.get(layer.image);
  if (cached?.status === "loaded" && cached.image) return cached.image;
  if (cached?.status === "loading" || cached?.status === "error") return null;
  if (typeof Image === "undefined") return null;

  const image = new Image();
  image.decoding = "async";
  overlayImageCache.set(layer.image, { status: "loading", image: null });
  image.onload = () => {
    overlayImageCache.set(layer.image!, { status: "loaded", image });
  };
  image.onerror = () => {
    overlayImageCache.set(layer.image!, { status: "error", image: null });
  };
  image.src = layer.image;
  return null;
}

function drawText(ctx: CanvasRenderingContext2D, layer: DesignLayer) {
  if (!layer.text) return;
  ctx.save();
  ctx.globalAlpha = layer.transform.opacity;
  ctx.fillStyle = layer.color ?? "#ffffff";
  ctx.font = `${layer.fontSize ?? 24}px Inter, sans-serif`;
  ctx.translate(layer.transform.x, layer.transform.y);
  ctx.rotate((layer.transform.rotation * Math.PI) / 180);
  ctx.scale(layer.transform.scale, layer.transform.scale);
  ctx.fillText(layer.text, 0, 0);
  ctx.restore();
}

function drawBrush(ctx: CanvasRenderingContext2D, layer: DesignLayer) {
  if (!layer.points?.length) return;
  layer.points.forEach((point) => {
    ctx.save();
    ctx.globalAlpha = point.opacity;
    ctx.globalCompositeOperation = point.erase ? "destination-out" : "source-over";
    const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, point.size);
    gradient.addColorStop(0, layer.color ?? "#ef4444");
    gradient.addColorStop(point.softness, layer.color ?? "#ef4444");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawZoneColor(ctx: CanvasRenderingContext2D, state: DesignState, layer: DesignLayer) {
  const zone = TEMPLATE_ZONES[state.template][layer.zone];
  if (!zone) return;
  ctx.save();
  ctx.globalAlpha = layer.transform.opacity;
  ctx.fillStyle = layer.color ?? "#64748b";
  ctx.fillRect(zone.left, zone.top, zone.width, zone.height);
  ctx.restore();
}

function withZoneTransform(ctx: CanvasRenderingContext2D, zone: ZoneRect, layer: DesignLayer, draw: () => void) {
  const centerX = zone.left + zone.width / 2 + layer.transform.x;
  const centerY = zone.top + zone.height / 2 + layer.transform.y;
  ctx.save();
  ctx.beginPath();
  ctx.rect(zone.left, zone.top, zone.width, zone.height);
  ctx.clip();
  ctx.globalAlpha = layer.transform.opacity;
  ctx.translate(centerX, centerY);
  ctx.rotate((layer.transform.rotation * Math.PI) / 180);
  ctx.scale(layer.transform.scale, layer.transform.scale);
  draw();
  ctx.restore();
}

function drawPatternTile(ctx: CanvasRenderingContext2D, layer: DesignLayer, x: number, y: number, size: number) {
  const variant = layer.assetId ?? "pattern_generic";
  const tint = layer.color ?? "#cbd5e1";
  if (variant.includes("houndstooth")) {
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, size * 0.55, size * 0.55);
    ctx.fillRect(x + size * 0.45, y + size * 0.45, size * 0.55, size * 0.55);
    ctx.fillStyle = "rgba(15,23,42,0.35)";
    ctx.fillRect(x + size * 0.2, y + size * 0.6, size * 0.2, size * 0.2);
    return;
  }

  ctx.fillStyle = tint;
  ctx.fillRect(x, y, size * 0.5, size * 0.5);
  ctx.fillRect(x + size * 0.5, y + size * 0.5, size * 0.5, size * 0.5);
  ctx.fillStyle = "rgba(15,23,42,0.2)";
  ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.1);
}

function drawPatternOverlay(ctx: CanvasRenderingContext2D, zone: ZoneRect, layer: DesignLayer) {
  withZoneTransform(ctx, zone, layer, () => {
    const tileSize = Math.max(8, 18);
    const startX = -zone.width / 2;
    const startY = -zone.height / 2;
    const anchorX = layer.transform.x % tileSize;
    const anchorY = layer.transform.y % tileSize;

    for (let y = startY - tileSize + anchorY; y <= zone.height / 2 + tileSize; y += tileSize) {
      for (let x = startX - tileSize + anchorX; x <= zone.width / 2 + tileSize; x += tileSize) {
        drawPatternTile(ctx, layer, x, y, tileSize);
      }
    }
  });
}

function drawAssetShape(ctx: CanvasRenderingContext2D, layer: DesignLayer, width: number, height: number) {
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

  if (category === "accessory" || category === "hair") {
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(width, height) * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(width, height) * 0.28, 0, Math.PI * 2);
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

function drawOverlayLayer(ctx: CanvasRenderingContext2D, state: DesignState, layer: DesignLayer) {
  const zone = TEMPLATE_ZONES[state.template][layer.zone];
  if (!zone) return;

  if (isPatternLayer(layer)) {
    drawPatternOverlay(ctx, zone, layer);
    return;
  }

  const source = getOverlayImage(layer);
  const widthRatio = layer.type === "accessoryLayer" ? 0.65 : layer.type === "moduleLayer" ? 0.75 : 0.9;
  const heightRatio = layer.type === "moduleLayer" ? 0.38 : layer.type === "accessoryLayer" ? 0.65 : 0.9;

  withZoneTransform(ctx, zone, layer, () => {
    const drawWidth = zone.width * widthRatio;
    const drawHeight = zone.height * heightRatio;

    if (source) {
      ctx.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      return;
    }

    drawAssetShape(ctx, layer, drawWidth, drawHeight);
  });
}

export function renderDesignToCanvas(state: DesignState, canvas: HTMLCanvasElement): string {
  canvas.width = TEMPLATE_SIZE.width;
  canvas.height = TEMPLATE_SIZE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  state.layers.forEach((layer) => {
    if (!layer.transform.visible) return;
    if (layer.type === "paintLayerSet") drawZoneColor(ctx, state, layer);
    if (layer.type === "textLayer") drawText(ctx, layer);
    if (layer.type === "brushLayer") drawBrush(ctx, layer);
    if (layer.type === "imageLayer" || layer.type === "accessoryLayer" || layer.type === "moduleLayer") {
      drawOverlayLayer(ctx, state, layer);
    }
  });

  return canvas.toDataURL("image/png");
}
