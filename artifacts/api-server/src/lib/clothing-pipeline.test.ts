import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "fs";
import os from "os";
import * as path from "path";
import { PNG } from "pngjs";
import {
  compileClassicClothing,
  compileExportPlan,
  isAllowedImageSource,
  parseDesignSpec,
  type ClothingSpec,
  type DesignSpec,
} from "./clothing-compiler";
import { validateClassicClothing, MAX_ARTIFACT_BYTES } from "./clothing-validator";
import { LocalArtifactStore } from "./artifact-storage";
import { TEMPLATE_SIZE } from "./clothing-templates";
import { isObjectStoragePath, resolveLatestCanonicalExportArtifact } from "./roblox-publish-pipeline";

function shirtDesign(baseColor = "#2563eb"): DesignSpec {
  return {
    template: "shirt",
    baseColor,
    layers: [
      {
        type: "paintLayerSet",
        zone: "front",
        color: "#f97316",
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true },
      },
      {
        type: "textLayer",
        zone: "front",
        text: "MY SKIN",
        color: "#ffffff",
        fontSize: 28,
        transform: { x: 220, y: 160, scale: 1, rotation: 0, opacity: 1, visible: true },
      },
    ],
  };
}

function pantsDesign(baseColor = "#16a34a"): DesignSpec {
  return {
    template: "pants",
    baseColor,
    layers: [
      {
        type: "paintLayerSet",
        zone: "left_leg_front",
        color: "#0f172a",
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true },
      },
    ],
  };
}

async function runPipeline(spec: ClothingSpec, store: LocalArtifactStore) {
  const compiled = await compileClassicClothing(spec);
  const report = validateClassicClothing({ png: compiled.png, sha256: compiled.sha256, templateType: spec.type });
  assert.equal(report.ok, true, JSON.stringify(report.checks.filter((c) => !c.passed)));
  const stored = await store.putArtifact({ bytes: compiled.png, mimeType: compiled.mimeType, sha256: compiled.sha256 });
  assert.equal(await store.verifyArtifactHash(stored.objectPath, compiled.sha256), true);
  const url = await store.createSignedDownloadUrl(stored.objectPath);
  assert.ok(url.includes("token="));
  const roundTripped = await store.getArtifactBytes(stored.objectPath);
  assert.ok(roundTripped && roundTripped.equals(compiled.png), "download must serve the exact compiled pixels");
  return { compiled, report, stored };
}

test("integration: shirt-only export plan compiles, validates and stores", async () => {
  const store = new LocalArtifactStore(await fs.mkdtemp(path.join(os.tmpdir(), "artifact-test-")));
  const { compiled } = await runPipeline({ specId: "spec-shirt", type: "shirt", design: shirtDesign() }, store);
  assert.equal(compiled.artifactClass, "ClassicShirtArtifact");
  assert.equal(compiled.width, TEMPLATE_SIZE.width);
  assert.equal(compiled.height, TEMPLATE_SIZE.height);
  const png = PNG.sync.read(compiled.png);
  assert.equal(png.width, 585);
  assert.equal(png.height, 559);
});

test("integration: pants-only export plan compiles, validates and stores", async () => {
  const store = new LocalArtifactStore(await fs.mkdtemp(path.join(os.tmpdir(), "artifact-test-")));
  const { compiled } = await runPipeline({ specId: "spec-pants", type: "pants", design: pantsDesign() }, store);
  assert.equal(compiled.artifactClass, "ClassicPantsArtifact");
  assert.ok(compiled.byteSize > 0 && compiled.byteSize <= MAX_ARTIFACT_BYTES);
});

test("integration: shirt+pants export plan produces two distinct artifacts", async () => {
  const store = new LocalArtifactStore(await fs.mkdtemp(path.join(os.tmpdir(), "artifact-test-")));
  const artifacts = await compileExportPlan([
    { specId: "spec-shirt", type: "shirt", design: shirtDesign() },
    { specId: "spec-pants", type: "pants", design: pantsDesign() },
  ]);
  assert.equal(artifacts.length, 2);
  assert.equal(artifacts[0].artifactClass, "ClassicShirtArtifact");
  assert.equal(artifacts[1].artifactClass, "ClassicPantsArtifact");
  assert.notEqual(artifacts[0].sha256, artifacts[1].sha256, "different specs must produce different bytes");
  for (const artifact of artifacts) {
    const report = validateClassicClothing({ png: artifact.png, sha256: artifact.sha256, templateType: artifact.templateType });
    assert.equal(report.ok, true);
    const stored = await store.putArtifact({ bytes: artifact.png, mimeType: artifact.mimeType, sha256: artifact.sha256 });
    assert.equal(await store.verifyArtifactHash(stored.objectPath, artifact.sha256), true);
  }
});

test("compiler is deterministic; different specs differ", async () => {
  const a = await compileClassicClothing({ specId: "a", type: "shirt", design: shirtDesign() });
  const b = await compileClassicClothing({ specId: "b", type: "shirt", design: shirtDesign() });
  const c = await compileClassicClothing({ specId: "c", type: "shirt", design: shirtDesign("#dc2626") });
  assert.equal(a.sha256, b.sha256, "identical design must produce identical bytes");
  assert.notEqual(a.sha256, c.sha256, "changed design must produce different bytes");
});

test("empty (fully transparent) output is rejected", async () => {
  const png = new PNG({ width: 585, height: 559 });
  const buffer = PNG.sync.write(png);
  const report = validateClassicClothing({ png: buffer, sha256: "a".repeat(64), templateType: "shirt" });
  assert.equal(report.ok, false);
  assert.ok(report.checks.find((c) => c.name === "non_empty_output" && !c.passed));
});

test("wrong dimensions are rejected", async () => {
  const png = new PNG({ width: 100, height: 100 });
  png.data.fill(255);
  const buffer = PNG.sync.write(png);
  const report = validateClassicClothing({ png: buffer, sha256: "b".repeat(64), templateType: "shirt" });
  assert.equal(report.ok, false);
  assert.ok(report.checks.find((c) => c.name === "dimensions_585x559" && !c.passed));
});

test("duplicate hashes are flagged", async () => {
  const compiled = await compileClassicClothing({ specId: "dup", type: "shirt", design: shirtDesign() });
  const report = validateClassicClothing({
    png: compiled.png,
    sha256: compiled.sha256,
    templateType: "shirt",
    previousHashes: new Set([compiled.sha256]),
  });
  assert.ok(report.checks.find((c) => c.name === "duplicate_output" && !c.passed));
});

test("parseDesignSpec tolerates malformed canvasData and preview-only layers are excluded", async () => {
  const spec = parseDesignSpec("not-json{{{", "shirt");
  assert.equal(spec.template, "shirt");
  assert.equal(spec.layers.length, 0);

  const withAccessory: DesignSpec = {
    template: "shirt",
    baseColor: "#2563eb",
    layers: [
      { type: "accessoryLayer", zone: "front", color: "#000000", transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 } },
    ],
  };
  const base = await compileClassicClothing({ specId: "base", type: "shirt", design: { ...withAccessory, layers: [] } });
  const withLayer = await compileClassicClothing({ specId: "acc", type: "shirt", design: withAccessory });
  assert.equal(base.sha256, withLayer.sha256, "accessory (preview-only) layers must not affect the export");
});

test("integration: object-backed export artifact resolves as canonical for Roblox upload", async () => {
  const store = new LocalArtifactStore(await fs.mkdtemp(path.join(os.tmpdir(), "artifact-test-")));
  const { compiled, stored } = await runPipeline({ specId: "spec-upload", type: "shirt", design: shirtDesign() }, store);

  // The exports route persists the internal object path as the artifact URL.
  assert.ok(isObjectStoragePath(stored.objectPath), "stored artifact URL must be recognised as object-backed");

  const resolution = resolveLatestCanonicalExportArtifact([
    {
      exportJobId: "job-1",
      exportJobCreatedAt: new Date("2026-07-30T00:00:00Z"),
      artifactId: "artifact-1",
      artifactUrl: stored.objectPath,
      width: compiled.width,
      height: compiled.height,
      size: compiled.byteSize,
      artifactCreatedAt: new Date("2026-07-30T00:00:00Z"),
    },
  ]);
  assert.equal(resolution.ok, true, "canonical resolution must accept object-backed artifacts");
  if (resolution.ok) {
    // Upload flow signs the object path into a consumable URL at upload time.
    const signedUrl = await store.createSignedDownloadUrl(resolution.artifact.artifactUrl!, 60);
    assert.ok(signedUrl.length > 0 && !isObjectStoragePath(signedUrl));
  }
});

test("canonical resolution still rejects null/invalid artifact urls", () => {
  const base = {
    exportJobId: "job-1",
    exportJobCreatedAt: new Date("2026-07-30T00:00:00Z"),
    artifactId: "artifact-1",
    width: 585,
    height: 559,
    size: 1000,
    artifactCreatedAt: new Date("2026-07-30T00:00:00Z"),
  };
  assert.equal(resolveLatestCanonicalExportArtifact([{ ...base, artifactUrl: null }]).ok, false);
  assert.equal(resolveLatestCanonicalExportArtifact([{ ...base, artifactUrl: "not-a-url" }]).ok, false);
  assert.equal(resolveLatestCanonicalExportArtifact([{ ...base, artifactUrl: "//protocol-relative" }]).ok, false);
  assert.equal(resolveLatestCanonicalExportArtifact([{ ...base, artifactUrl: "https://example.com/a.png" }]).ok, true);
});

test("SSRF guard: compiler never fetches remote image URLs", async () => {
  assert.equal(isAllowedImageSource("data:image/png;base64,AAAA"), true);
  assert.equal(isAllowedImageSource("http://127.0.0.1:1106/token"), false);
  assert.equal(isAllowedImageSource("http://169.254.169.254/latest/meta-data"), false);
  assert.equal(isAllowedImageSource("https://example.com/x.png"), false);
  assert.equal(isAllowedImageSource("file:///etc/passwd"), false);
  assert.equal(isAllowedImageSource("data:text/html;base64,AAAA"), false);

  // Compiling a design whose layer references an internal http URL must not
  // perform any network fetch and must render as if the image failed to load.
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("fetch must not be called by the compiler");
  }) as typeof fetch;
  try {
    const design: DesignSpec = {
      template: "shirt",
      baseColor: "#2563eb",
      layers: [
        {
          type: "imageLayer",
          zone: "front",
          image: "http://127.0.0.1:1106/internal",
          transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true },
        },
      ],
    };
    const withUrl = await compileClassicClothing({ specId: "ssrf", type: "shirt", design });
    const withoutLayer = await compileClassicClothing({ specId: "plain", type: "shirt", design: { ...design, layers: [] } });
    assert.equal(fetchCalled, false, "no network request may originate from the compiler");
    assert.equal(withUrl.sha256, withoutLayer.sha256, "unloadable remote image renders nothing");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("quarantine and delete lifecycle", async () => {
  const store = new LocalArtifactStore(await fs.mkdtemp(path.join(os.tmpdir(), "artifact-test-")));
  const compiled = await compileClassicClothing({ specId: "q", type: "shirt", design: shirtDesign() });
  const stored = await store.putArtifact({ bytes: compiled.png, mimeType: compiled.mimeType, sha256: compiled.sha256 });
  await store.quarantineArtifact(stored.objectPath, "test-reason");
  const meta = await store.getArtifactMetadata(stored.objectPath);
  assert.ok(meta);
  await store.deleteArtifact(stored.objectPath);
  assert.equal(await store.getArtifactBytes(stored.objectPath), null);
});
