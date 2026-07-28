import assert from "node:assert/strict";
import test from "node:test";
import { createHood, createHoodieTorso, createPocket, createSleeve, HOODIE_PARTS } from "./ai-geometry/hoodie-geometry.ts";

test("procedural hoodie contains every mandatory construction region", () => {
  for (const part of ["torso","left-sleeve","right-sleeve","left-cuff","right-cuff","waistband","hood-exterior","hood-interior","hood-opening","kangaroo-pocket","left-drawstring","right-drawstring"]) assert.ok(HOODIE_PARTS.includes(part as never), part);
});

test("hoodie topology is deterministic and bounded", () => {
  const builds = [createHoodieTorso(), createSleeve(-1), createSleeve(1), createHood(), createPocket()];
  const triangles = builds.map(g => (g.getIndex()?.count ?? g.getAttribute("position").count) / 3);
  assert.deepEqual(triangles, [createHoodieTorso(), createSleeve(-1), createSleeve(1), createHood(), createPocket()].map(g => (g.getIndex()?.count ?? g.getAttribute("position").count) / 3));
  assert.ok(triangles.reduce((a,b)=>a+b,0) < 12_000);
  builds.forEach(g => { g.computeBoundingBox(); assert.ok(g.boundingBox); });
});
