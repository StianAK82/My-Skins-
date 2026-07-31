import assert from "node:assert/strict";
import test from "node:test";
import { constructionDetailsFor } from "./fashion-construction-validator";
import {
  compileConstructionGeometry,
  repairConstructionGeometry,
  verifyConstructionGeometry,
} from "./construction-geometry";

const item = (kind: string, details = constructionDetailsFor(kind)) => ({
  id: `top-${kind}-01`,
  kind,
  material: "cotton",
  constructionDetails: details,
});

test("metadata-only requirements fail geometry verification", () => {
  const hoodie = item("hoodie");
  const report = verifyConstructionGeometry(hoodie, {
    itemId: hoodie.id,
    kind: hoodie.kind,
    parameters: {},
    groups: [],
  });
  assert.equal(report.passed, false);
  assert.equal(
    report.evidence.find((e) => e.feature === "hood_fold")?.measured,
    null,
  );
});

test("complete hoodie geometry passes with measured evidence", () => {
  const hoodie = item("hoodie");
  const report = verifyConstructionGeometry(
    hoodie,
    compileConstructionGeometry(hoodie),
  );
  assert.equal(report.passed, true);
  assert.equal(
    report.evidence.find((e) => e.feature === "hood_depth")?.measured,
    0.34,
  );
});

test("missing hood fold fails and bounded repair restores only the defect", () => {
  const hoodie = item("hoodie");
  const geometry = compileConstructionGeometry(hoodie);
  geometry.groups = geometry.groups.filter((g) => g.name !== "hood_fold");
  const repair = repairConstructionGeometry(hoodie, geometry);
  assert.equal(repair.before.passed, false);
  assert.equal(
    repair.after.evidence.find((e) => e.feature === "hood_fold")?.passed,
    true,
  );
  assert.equal(repair.accepted, true);
});

test("hoodie variants are measurable and zip front is divided without a pocket", () => {
  const regular = compileConstructionGeometry(item("hoodie"));
  const oversized = compileConstructionGeometry(item("oversized_hoodie"));
  const zip = compileConstructionGeometry(item("zip_hoodie"));
  assert.notEqual(
    regular.parameters.hood_width,
    oversized.parameters.hood_width,
  );
  assert.ok(zip.groups.some((g) => g.name === "front_left"));
  assert.ok(zip.groups.some((g) => g.name === "front_right"));
  assert.ok(!zip.groups.some((g) => g.name.includes("pocket")));
});

test("outerwear has distinct construction groups", () => {
  assert.ok(
    compileConstructionGeometry(item("bomber_jacket")).groups.some(
      (g) => g.name === "rib_collar",
    ),
  );
  assert.ok(
    compileConstructionGeometry(item("blazer")).groups.some(
      (g) => g.name === "lapels",
    ),
  );
  assert.equal(
    compileConstructionGeometry(item("puffer_jacket")).groups.filter((g) =>
      g.name.startsWith("quilt_sections:"),
    ).length,
    6,
  );
});

test("cargo, shoes, and hair compile complete and distinct geometry", () => {
  assert.equal(
    compileConstructionGeometry(item("cargo_pants")).groups.filter((g) =>
      g.name.startsWith("side_pockets:"),
    ).length,
    2,
  );
  assert.equal(
    compileConstructionGeometry(item("shoes")).groups.filter((g) =>
      g.name.startsWith("shoes:"),
    ).length,
    2,
  );
  const long = compileConstructionGeometry(item("long_hair"));
  const short = compileConstructionGeometry(item("short_hair"));
  assert.ok(
    long.groups.some((g) => g.name === "hair_front") &&
      long.groups.some((g) => g.name === "hair_sides") &&
      long.groups.some((g) => g.name === "hair_back"),
  );
  assert.notDeepEqual(long.parameters, short.parameters);
});
