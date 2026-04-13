import test from "node:test";
import assert from "node:assert/strict";
import type { DesignState } from "./design-state.ts";
import { renderDesignToCanvas } from "./renderer.ts";

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
  version: 3,
  template: "shirt",
  activeTool: "templates",
  activeZone: "front",
  selectedLayerId: null,
  paintSwatch: "#ffffff",
  preview: { split: true, mode: "split", bodyType: "blocky", view: "front" },
  aiPlanPreview: [],
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

test("pattern assets render as tiled overlays with clipping", () => {
  const canvas = new FakeCanvas() as unknown as HTMLCanvasElement;
  renderDesignToCanvas(
    {
      ...baseState,
      layers: [
        { id: "p", name: "Pattern", type: "moduleLayer", zone: "front", assetCategory: "pattern", assetId: "pattern_houndstooth", color: "#abcdef", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.8, visible: true, locked: false } },
      ],
    },
    canvas,
  );

  const ops = (canvas as unknown as FakeCanvas).context.ops;
  assert.equal(ops.some((op) => op.name === "clip"), true);
  assert.equal(ops.filter((op) => op.name === "fillRect").length > 8, true);
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
  // first pass primes cache, second pass should draw image
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
