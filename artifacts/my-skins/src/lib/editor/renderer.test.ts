import test from "node:test";
import assert from "node:assert/strict";
import { defaultAvatarState, type DesignState } from "./design-state.ts";
import { preloadOverlayImages, renderDesignToCanvas } from "./renderer.ts";

type Op = { name: string; args?: unknown[] };

class FakeGradient {
  addColorStop() {}
}

class FakeContext {
  ops: Op[] = [];
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth = 1;
  font = "";
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = "source-over";

  save() { this.ops.push({ name: "save" }); }
  restore() { this.ops.push({ name: "restore" }); }
  beginPath() { this.ops.push({ name: "beginPath" }); }
  rect(...args: number[]) { this.ops.push({ name: "rect", args }); }
  clip() { this.ops.push({ name: "clip" }); }
  clearRect(...args: number[]) { this.ops.push({ name: "clearRect", args }); }
  fillRect(...args: number[]) { this.ops.push({ name: "fillRect", args }); }
  strokeRect(...args: number[]) { this.ops.push({ name: "strokeRect", args }); }
  translate(...args: number[]) { this.ops.push({ name: "translate", args }); }
  rotate(...args: number[]) { this.ops.push({ name: "rotate", args }); }
  scale(...args: number[]) { this.ops.push({ name: "scale", args }); }
  fillText(...args: unknown[]) { this.ops.push({ name: "fillText", args }); }
  arc(...args: number[]) { this.ops.push({ name: "arc", args }); }
  fill() { this.ops.push({ name: "fill" }); }
  stroke() { this.ops.push({ name: "stroke" }); }
  moveTo(...args: number[]) { this.ops.push({ name: "moveTo", args }); }
  lineTo(...args: number[]) { this.ops.push({ name: "lineTo", args }); }
  closePath() { this.ops.push({ name: "closePath" }); }
  roundRect(...args: number[]) { this.ops.push({ name: "roundRect", args }); }
  drawImage(...args: unknown[]) { this.ops.push({ name: "drawImage", args }); }
  createRadialGradient() { return new FakeGradient(); }
}

class FakeCanvas {
  width = 0;
  height = 0;
  context = new FakeContext();

  getContext(kind: string) {
    if (kind !== "2d") return null;
    return this.context as unknown as CanvasRenderingContext2D;
  }

  toDataURL() {
    return "data:image/png;base64,fake";
  }
}

const baseState: DesignState = {
  version: 4,
  template: "shirt",
  activeTool: "templates",
  activeZone: "front",
  selectedLayerId: null,
  paintSwatch: "#ffffff",
  preview: { split: true, mode: "split", bodyType: "blocky", view: "front" },
  avatar: defaultAvatarState(),
  aiPlanPreview: [],
  aiAvatarPreview: null,
  layers: [],
};

test("renderer keeps layer order deterministic for stacked overlays", () => {
  const canvas = new FakeCanvas() as unknown as HTMLCanvasElement;
  renderDesignToCanvas(
    {
      ...baseState,
      layers: [
        { id: "a", name: "A", type: "moduleLayer", zone: "front", assetCategory: "module", color: "#111111", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
        { id: "b", name: "B", type: "moduleLayer", zone: "front", assetCategory: "module", color: "#222222", transform: { x: 10, y: 4, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
      ],
    },
    canvas,
  );

  const translates = (canvas as unknown as FakeCanvas).context.ops.filter((op) => op.name === "translate");
  assert.equal(translates.length >= 2, true);
  assert.deepEqual(translates[0]?.args, [260, 182]);
  assert.deepEqual(translates[1]?.args, [270, 186]);
});

test("pattern assets tile image content with clipping and deterministic transform", () => {
  const previousImage = globalThis.Image;
  class LoadedImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    decoding = "";
    set src(_value: string) {
      if (this.onload) this.onload();
    }
  }
  globalThis.Image = LoadedImage as unknown as typeof Image;

  try {
    const state: DesignState = {
      ...baseState,
      layers: [
        { id: "p", name: "Pattern", type: "moduleLayer", zone: "front", assetCategory: "pattern", assetId: "pattern_houndstooth", transform: { x: 11, y: 7, scale: 1, rotation: 0, opacity: 0.8, visible: true, locked: false } },
      ],
    };

    renderDesignToCanvas(state, new FakeCanvas() as unknown as HTMLCanvasElement);
    const second = new FakeCanvas();
    renderDesignToCanvas(state, second as unknown as HTMLCanvasElement);

    const ops = second.context.ops;
    assert.equal(ops.some((op) => op.name === "clip"), true);
    assert.equal(ops.some((op) => op.name === "drawImage"), true);
    assert.deepEqual(ops.find((op) => op.name === "translate")?.args, [271, 189]);
  } finally {
    globalThis.Image = previousImage;
  }
});

test("module assets use catalog overlay images instead of fallback geometry once cached", () => {
  const previousImage = globalThis.Image;
  class LoadedImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    decoding = "";
    set src(_value: string) {
      if (this.onload) this.onload();
    }
  }
  globalThis.Image = LoadedImage as unknown as typeof Image;

  try {
    const state: DesignState = {
      ...baseState,
      layers: [
        { id: "img", name: "Loading image", type: "imageLayer", zone: "front", image: "data:image/png;base64,pending_only_unique", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
      ],
    };

    renderDesignToCanvas(state, new FakeCanvas() as unknown as HTMLCanvasElement);

    const second = new FakeCanvas();
    renderDesignToCanvas(state, second as unknown as HTMLCanvasElement);
    assert.equal(second.context.ops.some((op) => op.name === "drawImage"), true);
    assert.equal(second.context.ops.some((op) => op.name === "strokeRect"), false);
  } finally {
    globalThis.Image = previousImage;
  }
});

test("overlay layers with image sources do not draw placeholder geometry while image is loading", () => {
  const previousImage = globalThis.Image;
  class PendingImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    decoding = "";
    set src(_value: string) {}
  }
  globalThis.Image = PendingImage as unknown as typeof Image;

  try {
    const state: DesignState = {
      ...baseState,
      layers: [
        { id: "mod", name: "Pocket", type: "moduleLayer", zone: "front", assetId: "module_pocket", assetCategory: "module", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
      ],
    };

    const canvas = new FakeCanvas();
    renderDesignToCanvas(state, canvas as unknown as HTMLCanvasElement);
    assert.equal(canvas.context.ops.some((op) => op.name === "strokeRect"), false);
    assert.equal(canvas.context.ops.some((op) => op.name === "drawImage"), false);
  } finally {
    globalThis.Image = previousImage;
  }
});

test("image layers use actual image draw path when image is ready", () => {
  const previousImage = globalThis.Image;
  class LoadedImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    decoding = "";
    set src(_value: string) {
      if (this.onload) this.onload();
    }
  }
  globalThis.Image = LoadedImage as unknown as typeof Image;

  try {
    const state: DesignState = {
      ...baseState,
      layers: [
        { id: "img", name: "Image", type: "imageLayer", zone: "front", image: "data:image/png;base64,abc", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
      ],
    };

    renderDesignToCanvas(state, new FakeCanvas() as unknown as HTMLCanvasElement);

    const second = new FakeCanvas();
    renderDesignToCanvas(state, second as unknown as HTMLCanvasElement);
    assert.equal(second.context.ops.some((op) => op.name === "drawImage"), true);
  } finally {
    globalThis.Image = previousImage;
  }
});

test("renderer notifies when async overlay images are ready", () => {
  const previousImage = globalThis.Image;
  class LoadedImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    decoding = "";
    set src(_value: string) {
      if (this.onload) this.onload();
    }
  }
  globalThis.Image = LoadedImage as unknown as typeof Image;

  let calls = 0;
  try {
    renderDesignToCanvas(
      {
        ...baseState,
        layers: [
          { id: "img", name: "Image", type: "imageLayer", zone: "front", image: "data:image/png;base64,def", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
        ],
      },
      new FakeCanvas() as unknown as HTMLCanvasElement,
      { onOverlayImageReady: () => { calls += 1; } },
    );

    assert.equal(calls, 1);
  } finally {
    globalThis.Image = previousImage;
  }
});

test("preloadOverlayImages resolves overlay sources before export render", async () => {
  const previousImage = globalThis.Image;
  class LoadedImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    decoding = "";
    set src(_value: string) {
      if (this.onload) this.onload();
    }
  }
  globalThis.Image = LoadedImage as unknown as typeof Image;

  try {
    const state: DesignState = {
      ...baseState,
      layers: [
        { id: "img", name: "Image", type: "imageLayer", zone: "front", image: "data:image/png;base64,ghi", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
      ],
    };

    await preloadOverlayImages(state);
    const canvas = new FakeCanvas();
    renderDesignToCanvas(state, canvas as unknown as HTMLCanvasElement);
    assert.equal(canvas.context.ops.some((op) => op.name === "drawImage"), true);
  } finally {
    globalThis.Image = previousImage;
  }
});

test("export operations are deterministic for representative layered designs", () => {
  const canvasA = new FakeCanvas();
  const canvasB = new FakeCanvas();
  const state: DesignState = {
    ...baseState,
    layers: [
      { id: "paint", name: "Paint", type: "paintLayerSet", zone: "front", color: "#334155", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.7, visible: true, locked: false } },
      { id: "text", name: "Text", type: "textLayer", zone: "front", text: "BETA", color: "#ffffff", fontSize: 20, transform: { x: 240, y: 170, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
      { id: "brush", name: "Brush", type: "brushLayer", zone: "front", color: "#22d3ee", points: [{ x: 220, y: 170, size: 10, opacity: 0.8, softness: 0.7 }], transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
      { id: "overlay", name: "Overlay", type: "moduleLayer", zone: "front", assetCategory: "module", color: "#0f172a", transform: { x: 5, y: -2, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
      { id: "hidden", name: "Hidden", type: "paintLayerSet", zone: "back", color: "#ef4444", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: false, locked: false } },
    ],
  };

  const first = renderDesignToCanvas(state, canvasA as unknown as HTMLCanvasElement);
  const second = renderDesignToCanvas(state, canvasB as unknown as HTMLCanvasElement);
  assert.equal(first, second);
  assert.deepEqual(canvasA.context.ops, canvasB.context.ops);
});

test("renderer uses category-driven overlay sizing for trim assets to match export/editor framing", () => {
  const previousImage = globalThis.Image;
  class LoadedImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    decoding = "";
    width = 192;
    height = 48;
    set src(_value: string) {
      if (this.onload) this.onload();
    }
  }
  globalThis.Image = LoadedImage as unknown as typeof Image;

  try {
    const state: DesignState = {
      ...baseState,
      layers: [
        { id: "trim", name: "Trim", type: "moduleLayer", zone: "front", assetCategory: "trim", assetId: "trim_gold", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false } },
      ],
    };
    renderDesignToCanvas(state, new FakeCanvas() as unknown as HTMLCanvasElement);
    const second = new FakeCanvas();
    renderDesignToCanvas(state, second as unknown as HTMLCanvasElement);

    const drawOp = second.context.ops.find((op) => op.name === "drawImage");
    assert.ok(drawOp);
    const [, , , width, height] = drawOp?.args ?? [];
    assert.equal(Number(width) > Number(height), true);
  } finally {
    globalThis.Image = previousImage;
  }
});
