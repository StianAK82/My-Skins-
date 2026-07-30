import { PNG } from "pngjs";
import { REQUIRED_COVERAGE_ZONES, TEMPLATE_SIZE, TEMPLATE_ZONES, type TemplateType } from "./clothing-templates";

export const MAX_ARTIFACT_BYTES = 4 * 1024 * 1024;
export const MIN_ZONE_COVERAGE = 0.6; // fraction of zone pixels that must be non-transparent

export type ValidationCheck = {
  name: string;
  passed: boolean;
  detail?: string;
};

export type ValidationReport = {
  ok: boolean;
  templateType: TemplateType;
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
  checks: ValidationCheck[];
};

type DecodedPng = { width: number; height: number; data: Buffer };

function decodePng(buffer: Buffer): DecodedPng | null {
  try {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  } catch {
    return null;
  }
}

function zoneCoverage(png: DecodedPng, left: number, top: number, width: number, height: number) {
  let opaque = 0;
  let total = 0;
  const x0 = Math.max(0, left);
  const y0 = Math.max(0, top);
  const x1 = Math.min(png.width, left + width);
  const y1 = Math.min(png.height, top + height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];
      total++;
      if (alpha > 8) opaque++;
    }
  }
  return total === 0 ? 0 : opaque / total;
}

function isEmptyImage(png: DecodedPng): boolean {
  let anyOpaque = false;
  let uniform = true;
  const first = [png.data[0], png.data[1], png.data[2], png.data[3]];
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] > 8) anyOpaque = true;
    if (uniform && (png.data[i] !== first[0] || png.data[i + 1] !== first[1] || png.data[i + 2] !== first[2] || png.data[i + 3] !== first[3])) {
      uniform = false;
    }
    if (anyOpaque && !uniform) return false;
  }
  // Fully transparent output is always empty. A uniform fully-transparent
  // buffer is rejected; a uniform opaque solid colour is a legal design.
  return !anyOpaque;
}

export function validateClassicClothing(input: {
  png: Buffer;
  sha256: string;
  templateType: TemplateType;
  previousHashes?: Set<string>;
}): ValidationReport {
  const checks: ValidationCheck[] = [];
  const { png, sha256, templateType } = input;

  const decoded = decodePng(png);
  checks.push({ name: "png_decodes", passed: Boolean(decoded), detail: decoded ? undefined : "Not a decodable PNG" });

  const width = decoded?.width ?? 0;
  const height = decoded?.height ?? 0;

  const dimensionsOk = width === TEMPLATE_SIZE.width && height === TEMPLATE_SIZE.height;
  checks.push({
    name: "dimensions_585x559",
    passed: dimensionsOk,
    detail: dimensionsOk ? undefined : `Got ${width}x${height}, expected ${TEMPLATE_SIZE.width}x${TEMPLATE_SIZE.height}`,
  });

  // pngjs always expands to RGBA — alpha channel presence check is that the
  // decoded buffer carries 4 channels per pixel of the declared size.
  const alphaOk = Boolean(decoded) && decoded!.data.length === width * height * 4;
  checks.push({ name: "alpha_channel", passed: alphaOk });

  const sizeOk = png.length > 0 && png.length <= MAX_ARTIFACT_BYTES;
  checks.push({ name: "output_size_limit", passed: sizeOk, detail: sizeOk ? undefined : `Size ${png.length} bytes out of bounds` });

  const empty = decoded ? isEmptyImage(decoded) : true;
  checks.push({ name: "non_empty_output", passed: !empty, detail: empty ? "Output image is empty/transparent" : undefined });

  if (decoded && dimensionsOk) {
    const zones = TEMPLATE_ZONES[templateType];
    for (const zoneKey of REQUIRED_COVERAGE_ZONES[templateType]) {
      const zone = zones[zoneKey];
      const coverage = zoneCoverage(decoded, zone.left, zone.top, zone.width, zone.height);
      const passed = coverage >= MIN_ZONE_COVERAGE;
      checks.push({
        name: `zone_coverage_${zoneKey}`,
        passed,
        detail: passed ? undefined : `Zone ${zoneKey} coverage ${(coverage * 100).toFixed(1)}% < ${MIN_ZONE_COVERAGE * 100}%`,
      });
    }
  } else {
    checks.push({ name: "template_zone_validation", passed: false, detail: "Skipped: image failed decode/dimension checks" });
  }

  const duplicate = Boolean(input.previousHashes?.has(sha256));
  checks.push({ name: "duplicate_output", passed: !duplicate, detail: duplicate ? "Identical artifact bytes already produced" : undefined });

  checks.push({ name: "content_hash", passed: /^[0-9a-f]{64}$/.test(sha256) });

  return {
    ok: checks.every((check) => check.passed),
    templateType,
    width,
    height,
    byteSize: png.length,
    sha256,
    checks,
  };
}
