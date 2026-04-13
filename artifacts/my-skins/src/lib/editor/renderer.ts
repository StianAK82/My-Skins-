import type { DesignLayer, DesignState } from "./design-state";
import { TEMPLATE_SIZE, TEMPLATE_ZONES } from "./templates";

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
    ctx.fillStyle = layer.color ?? "#ef4444";
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
    if (layer.type === "imageLayer" || layer.type === "accessoryLayer") {
      const zone = TEMPLATE_ZONES[state.template][layer.zone];
      if (!zone) return;
      ctx.save();
      ctx.globalAlpha = layer.transform.opacity;
      ctx.fillStyle = layer.color ?? "#f8fafc";
      ctx.fillRect(zone.left, zone.top, zone.width, zone.height);
      ctx.strokeStyle = "rgba(15,23,42,0.8)";
      ctx.strokeRect(zone.left + 3, zone.top + 3, zone.width - 6, zone.height - 6);
      ctx.restore();
    }
  });

  return canvas.toDataURL("image/png");
}
