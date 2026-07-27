import { decodePng, encodeRgba } from "./classic-atlas.ts";
import type { EnhancedGarmentSpecification } from "./classic-prompt-enhancer.ts";
import {
  GARMENT_LIBRARY,
  resolveGarmentKey,
  type GarmentKey,
  type GarmentModule,
} from "./garment-library.ts";

export type GarmentFingerprint = {
  key: GarmentKey;
  required: readonly GarmentModule[];
};

/** Structural details that must not be delegated to the image model. */
export const GARMENT_FINGERPRINTS = Object.fromEntries(
  Object.values(GARMENT_LIBRARY).map((template) => [
    template.key,
    { key: template.key, required: template.requiredModules },
  ]),
) as Record<GarmentKey, GarmentFingerprint>;

type Point = readonly [number, number];
type Canvas = { width: number; height: number; rgba: Buffer };

function fingerprintFor(
  spec: EnhancedGarmentSpecification,
): GarmentFingerprint {
  return GARMENT_FINGERPRINTS[
    resolveGarmentKey(`${spec.garmentType} ${spec.material}`)
  ];
}

function ink(canvas: Canvas, x: number, y: number, strength: number): void {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const offset = (Math.round(y) * canvas.width + Math.round(x)) * 4;
  if (canvas.rgba[offset + 3] < 32) return;
  const direction =
    (canvas.rgba[offset] + canvas.rgba[offset + 1] + canvas.rgba[offset + 2]) /
      3 >
    105
      ? -1
      : 1;
  for (let channel = 0; channel < 3; channel++)
    canvas.rgba[offset + channel] = Math.max(
      0,
      Math.min(255, canvas.rgba[offset + channel] + direction * strength),
    );
}

function line(
  canvas: Canvas,
  from: Point,
  to: Point,
  strength = 38,
  width = 2,
) {
  const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
  for (let step = 0; step <= steps; step++) {
    const x = from[0] + ((to[0] - from[0]) * step) / steps;
    const y = from[1] + ((to[1] - from[1]) * step) / steps;
    for (let dx = -width; dx <= width; dx++)
      for (let dy = -width; dy <= width; dy++)
        if (dx * dx + dy * dy <= width * width)
          ink(canvas, x + dx, y + dy, strength);
  }
}

function path(canvas: Canvas, points: Point[], strength = 38, width = 2) {
  for (let index = 1; index < points.length; index++)
    line(canvas, points[index - 1], points[index], strength, width);
}

function ellipseArc(
  canvas: Canvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  start: number,
  end: number,
  strength = 44,
  width = 2,
) {
  const points: Point[] = [];
  for (let index = 0; index <= 48; index++) {
    const angle = start + ((end - start) * index) / 48;
    points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
  }
  path(canvas, points, strength, width);
}

function ribbing(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height = 12,
) {
  line(canvas, [x, y], [x + width, y], 34, 2);
  for (let offset = 2; offset < width; offset += 4)
    line(canvas, [x + offset, y + 2], [x + offset, y + height], 18, 1);
}

function composeHoodie(canvas: Canvas) {
  // Front: neckline/hood opening, drawstrings, pocket, hem and tension folds.
  ellipseArc(canvas, 260, 121, 31, 18, 0, Math.PI, 52, 3);
  path(
    canvas,
    [
      [245, 123],
      [247, 147],
      [244, 163],
    ],
    48,
    2,
  );
  path(
    canvas,
    [
      [275, 123],
      [273, 147],
      [276, 163],
    ],
    48,
    2,
  );
  ellipseArc(canvas, 244, 164, 3, 3, 0, Math.PI * 2, 55, 2);
  ellipseArc(canvas, 276, 164, 3, 3, 0, Math.PI * 2, 55, 2);
  path(
    canvas,
    [
      [218, 194],
      [225, 178],
      [295, 178],
      [302, 194],
      [296, 225],
      [224, 225],
      [218, 194],
    ],
    42,
    2,
  );
  path(
    canvas,
    [
      [260, 179],
      [260, 221],
    ],
    18,
    1,
  );
  ribbing(canvas, 199, 232, 122, 11);
  path(
    canvas,
    [
      [222, 124],
      [215, 151],
      [218, 169],
    ],
    20,
    1,
  );
  path(
    canvas,
    [
      [298, 124],
      [305, 151],
      [302, 169],
    ],
    20,
    1,
  );

  // Back: unmistakably different rear hood construction and hem.
  ellipseArc(canvas, 402, 130, 38, 31, Math.PI, Math.PI * 2, 46, 3);
  path(
    canvas,
    [
      [402, 99],
      [402, 166],
    ],
    35,
    2,
  );
  path(
    canvas,
    [
      [364, 130],
      [376, 166],
      [428, 166],
      [440, 130],
    ],
    30,
    2,
  );
  ribbing(canvas, 341, 232, 122, 11);
  path(
    canvas,
    [
      [376, 172],
      [372, 210],
    ],
    18,
    1,
  );
  path(
    canvas,
    [
      [428, 172],
      [432, 210],
    ],
    18,
    1,
  );

  // Independent cuffs and sleeve seams on every long sleeve face.
  for (const x of [44, 76, 108, 140, 441, 473, 505, 537])
    ribbing(canvas, x + 1, x < 200 ? 232 : 402, 29, 11);
  path(
    canvas,
    [
      [77, 120],
      [80, 180],
      [77, 229],
    ],
    22,
    1,
  );
  path(
    canvas,
    [
      [474, 290],
      [478, 347],
      [475, 399],
    ],
    22,
    1,
  );
}

function composeTshirt(canvas: Canvas) {
  ellipseArc(canvas, 260, 120, 27, 13, 0, Math.PI, 48, 3);
  ribbing(canvas, 199, 234, 122, 7);
  for (const x of [44, 76, 108, 140])
    line(canvas, [x + 1, 188], [x + 29, 188], 32, 2);
  for (const x of [441, 473, 505, 537])
    line(canvas, [x + 1, 358], [x + 29, 358], 32, 2);
}

function composeJeans(canvas: Canvas) {
  ribbing(canvas, 198, 78, 124, 12);
  ribbing(canvas, 340, 78, 124, 12);
  path(
    canvas,
    [
      [260, 88],
      [260, 147],
      [274, 159],
    ],
    45,
    2,
  );
  ellipseArc(canvas, 221, 105, 22, 23, 0, Math.PI / 2, 40, 2);
  ellipseArc(canvas, 299, 105, 22, 23, Math.PI / 2, Math.PI, 40, 2);
  for (const x of [211, 235, 279, 303]) line(canvas, [x, 76], [x, 94], 43, 2);
  path(
    canvas,
    [
      [363, 119],
      [388, 108],
      [395, 145],
      [367, 153],
      [363, 119],
    ],
    40,
    2,
  );
  path(
    canvas,
    [
      [441, 119],
      [416, 108],
      [409, 145],
      [437, 153],
      [441, 119],
    ],
    40,
    2,
  );
}

/** Compose invariant garment construction over model-generated fabric/artwork. */
export function composeGarmentFingerprint(
  png: Buffer,
  spec: EnhancedGarmentSpecification,
) {
  const fingerprint = fingerprintFor(spec);
  const canvas = decodePng(png);
  if (fingerprint.key === "hoodie" || fingerprint.key === "zip-hoodie")
    composeHoodie(canvas);
  else if (GARMENT_LIBRARY[fingerprint.key].atlas === "shirt")
    composeTshirt(canvas);
  else composeJeans(canvas);
  return {
    png: encodeRgba(canvas.width, canvas.height, canvas.rgba),
    fingerprint,
  };
}

export function validateGarmentFingerprint(
  spec: EnhancedGarmentSpecification,
  applied?: GarmentFingerprint,
): string[] {
  const expected = fingerprintFor(spec);
  if (applied?.key !== expected.key)
    return [`missing required ${expected.key} garment fingerprint`];
  return [];
}
