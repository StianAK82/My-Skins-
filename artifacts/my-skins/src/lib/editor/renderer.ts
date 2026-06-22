import { getAssetById, getLayerOverlayImage } from "./assets.ts";
import type { DesignLayer, DesignState } from "./design-state.ts";
import { TEMPLATE_SIZE, TEMPLATE_ZONES, type ZoneRect } from "./templates.ts";

type ImageCacheEntry = { status: "loading" | "loaded" | "error"; image: CanvasImageSource | null };

type RenderTarget = "preview" | "export";

type RenderOptions = { onOverlayImageReady?: () => void; target?: RenderTarget };

const overlayImageCache = new Map<string, ImageCacheEntry>();

function isPatternLayer(layer: DesignLayer) {
  return layer.assetCategory === "pattern";
}

function getOverlayImage(layer: DesignLayer, options?: RenderOptions): CanvasImageSource | null {
  const src = getLayerOverlayImage(layer);
  if (!src) return null;
  const cached = overlayImageCache.get(src);
  if (cached?.status === "loaded" && cached.image) return cached.image;
  if (cached?.status === "loading" || cached?.status === "error") return null;
  if (typeof Image === "undefined") return null;

  const image = new Image();
  image.decoding = "async";
  overlayImageCache.set(src, { status: "loading", image: null });
  image.onload = () => {
    overlayImageCache.set(src, { status: "loaded", image });
    options?.onOverlayImageReady?.();
  };
  image.onerror = () => {
    overlayImageCache.set(src, { status: "error", image: null });
  };
  image.src = src;
  return null;
}

function getOverlaySource(layer: DesignLayer) {
  return getLayerOverlayImage(layer);
}

function isFiniteNumber(value: number) {
  return Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeLayerTransform(layer: DesignLayer): DesignLayer["transform"] {
  const scale = isFiniteNumber(layer.transform.scale) ? clamp(layer.transform.scale, 0.1, 4) : 1;
  const rotation = isFiniteNumber(layer.transform.rotation) ? clamp(layer.transform.rotation, -360, 360) : 0;
  const x = isFiniteNumber(layer.transform.x) ? clamp(layer.transform.x, -TEMPLATE_SIZE.width, TEMPLATE_SIZE.width) : 0;
  const y = isFiniteNumber(layer.transform.y) ? clamp(layer.transform.y, -TEMPLATE_SIZE.height, TEMPLATE_SIZE.height) : 0;
  const opacity = isFiniteNumber(layer.transform.opacity) ? clamp(layer.transform.opacity, 0, 1) : 1;
  return {
    ...layer.transform,
    x,
    y,
    scale,
    rotation,
    opacity,
    visible: layer.transform.visible !== false,
    locked: Boolean(layer.transform.locked),
  };
}

function shouldRenderLayerInTarget(layer: DesignLayer, target: RenderTarget) {
  if (target === "preview") return true;
  if (layer.type === "accessoryLayer") return false;
  const layerAsset = getAssetById(layer.assetId);
  if (layerAsset?.previewOnly) return false;
  if (layer.assetCategory === "hair" || layer.assetCategory === "accessory") return false;
  return true;
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

function withZoneClip(ctx: CanvasRenderingContext2D, zone: ZoneRect, draw: () => void) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(zone.left, zone.top, zone.width, zone.height);
  ctx.clip();
  draw();
  ctx.restore();
}

function withZoneTransform(ctx: CanvasRenderingContext2D, zone: ZoneRect, layer: DesignLayer, draw: () => void) {
  const centerX = zone.left + zone.width / 2 + layer.transform.x;
  const centerY = zone.top + zone.height / 2 + layer.transform.y;
  withZoneClip(ctx, zone, () => {
    ctx.globalAlpha = layer.transform.opacity;
    ctx.translate(centerX, centerY);
    ctx.rotate((layer.transform.rotation * Math.PI) / 180);
    ctx.scale(layer.transform.scale, layer.transform.scale);
    draw();
  });
}

function getOverlaySize(zone: ZoneRect, layer: DesignLayer) {
  const category = layer.assetCategory ?? "graphic";
  if (category === "trim") return { width: zone.width * 0.96, height: zone.height * 0.24 };
  if (category === "patch") return { width: zone.width * 0.34, height: zone.height * 0.34 };
  if (category === "accessory" || category === "hair") return { width: zone.width * 0.7, height: zone.height * 0.68 };
  if (category === "module") return { width: zone.width * 0.82, height: zone.height * 0.62 };
  const widthRatio = layer.type === "accessoryLayer" ? 0.7 : layer.type === "moduleLayer" ? 0.82 : 0.95;
  const heightRatio = layer.type === "moduleLayer" ? 0.62 : layer.type === "accessoryLayer" ? 0.7 : 0.95;
  return { width: zone.width * widthRatio, height: zone.height * heightRatio };
}

function getSourceSize(source: CanvasImageSource | null) {
  if (!source) return null;
  const width = "width" in source ? Number(source.width) : 0;
  const height = "height" in source ? Number(source.height) : 0;
  if (!width || !height) return null;
  return { width, height };
}

function fitSourceIntoBox(sourceSize: { width: number; height: number } | null, box: { width: number; height: number }) {
  if (!sourceSize) return box;
  const sourceRatio = sourceSize.width / sourceSize.height;
  const boxRatio = box.width / box.height;
  if (sourceRatio > boxRatio) {
    return { width: box.width, height: box.width / sourceRatio };
  }
  return { width: box.height * sourceRatio, height: box.height };
}

function drawFallbackAssetShape(ctx: CanvasRenderingContext2D, layer: DesignLayer, width: number, height: number) {
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

function drawPatternOverlay(ctx: CanvasRenderingContext2D, zone: ZoneRect, layer: DesignLayer, options?: RenderOptions) {
  const patternImage = getOverlayImage(layer, options);
  const fallbackTileSize = Math.max(12, Math.round(Math.min(zone.width, zone.height) / 4));
  const sourceSize = getSourceSize(patternImage);
  const baseTile = sourceSize ? Math.max(12, Math.round(Math.min(sourceSize.width, sourceSize.height))) : fallbackTileSize;
  const tileSize = Math.max(8, Math.round(baseTile * Math.max(layer.transform.scale, 0.1)));
  const centerX = zone.left + zone.width / 2 + layer.transform.x;
  const centerY = zone.top + zone.height / 2 + layer.transform.y;
  const drawRadius = Math.ceil(Math.sqrt(zone.width * zone.width + zone.height * zone.height) / 2) + tileSize * 2;

  withZoneClip(ctx, zone, () => {
    ctx.globalAlpha = layer.transform.opacity;
    ctx.translate(centerX, centerY);
    ctx.rotate((layer.transform.rotation * Math.PI) / 180);
    if (patternImage) {
      const offsetX = ((layer.transform.x % tileSize) + tileSize) % tileSize;
      const offsetY = ((layer.transform.y % tileSize) + tileSize) % tileSize;
      for (let y = -drawRadius + offsetY; y <= drawRadius; y += tileSize) {
        for (let x = -drawRadius + offsetX; x <= drawRadius; x += tileSize) {
          ctx.drawImage(patternImage, x - tileSize / 2, y - tileSize / 2, tileSize, tileSize);
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

function drawOverlayLayer(ctx: CanvasRenderingContext2D, state: DesignState, layer: DesignLayer, options?: RenderOptions) {
  const zone = TEMPLATE_ZONES[state.template][layer.zone];
  if (!zone) return;

  if (isPatternLayer(layer)) {
    drawPatternOverlay(ctx, zone, layer, options);
    return;
  }

  const source = getOverlayImage(layer, options);
  const sourceRequested = Boolean(getOverlaySource(layer));
  const baseSize = getOverlaySize(zone, layer);
  const { width, height } = fitSourceIntoBox(getSourceSize(source), baseSize);

  withZoneTransform(ctx, zone, layer, () => {
    if (source) {
      ctx.filter = layer.color && layer.assetCategory !== "pattern" ? `drop-shadow(0 0 0 ${layer.color})` : "none";
      ctx.drawImage(source, -width / 2, -height / 2, width, height);
      ctx.filter = "none";
      return;
    }

    if (sourceRequested) return;
    drawFallbackAssetShape(ctx, layer, width, height);
  });
}

export function preloadOverlayImages(state: DesignState) {
  const imageLayers = state.layers
    .filter((layer) => shouldRenderLayerInTarget(layer, "export"))
    .map((layer) => getOverlaySource(layer))
    .filter((src): src is string => Boolean(src));

  return Promise.all(imageLayers.map((src) => {
    const cached = overlayImageCache.get(src);
    if (cached?.status === "loaded") return Promise.resolve();
    if (cached?.status === "error") return Promise.resolve();
    return new Promise<void>((resolve) => {
      if (typeof Image === "undefined") {
        resolve();
        return;
      }
      const image = new Image();
      image.decoding = "async";
      overlayImageCache.set(src, { status: "loading", image: null });
      image.onload = () => {
        overlayImageCache.set(src, { status: "loaded", image });
        resolve();
      };
      image.onerror = () => {
        overlayImageCache.set(src, { status: "error", image: null });
        resolve();
      };
      image.src = src;
    });
  }));
}

export function renderDesignToCanvas(state: DesignState, canvas: HTMLCanvasElement, options?: RenderOptions): string {
  const target = options?.target ?? "preview";
  canvas.width = TEMPLATE_SIZE.width;
  canvas.height = TEMPLATE_SIZE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = state.baseColor ?? "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  state.layers.forEach((layer) => {
    if (!shouldRenderLayerInTarget(layer, target)) return;
    const normalizedLayer: DesignLayer = { ...layer, transform: normalizeLayerTransform(layer) };
    if (!normalizedLayer.transform.visible) return;
    if (normalizedLayer.type === "paintLayerSet") drawZoneColor(ctx, state, normalizedLayer);
    if (normalizedLayer.type === "textLayer") drawText(ctx, normalizedLayer);
    if (normalizedLayer.type === "brushLayer") drawBrush(ctx, normalizedLayer);
    if (normalizedLayer.type === "imageLayer" || normalizedLayer.type === "accessoryLayer" || normalizedLayer.type === "moduleLayer") {
      drawOverlayLayer(ctx, state, normalizedLayer, options);
    }
  });

  return canvas.toDataURL("image/png");
}
