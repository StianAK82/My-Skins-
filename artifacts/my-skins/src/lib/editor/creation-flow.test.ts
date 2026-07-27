import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/pages/Create.tsx"), "utf8");

test("creation UI has one child-friendly complete-skin action and no garment selector", () => {
  assert.match(source, />Describe your skin</);
  assert.match(source, /Create Skin/);
  assert.doesNotMatch(source, /setGarmentType|Clothing type|Classic \{type/);
});

test("complete preview and all result actions stay in one flow", () => {
  for (const label of ["Show Back", "Try Again", "Download Skin", "Save Skin", "Upload to Roblox"]) assert.match(source, new RegExp(label));
  assert.match(source, /shirtTextureUrl=.*pantsTextureUrl=/s);
  assert.match(source, /robloxItemCount/);
});

test("loading resets, duplicate submissions are guarded, and progress is visible", () => {
  assert.match(source, /busyRef\.current/);
  assert.match(source, /finally/);
  assert.match(source, /setLoading\(false\)/);
  for (const stage of ["Planning your skin", "Creating the top", "Creating the bottoms", "Building the preview"])
    assert.match(source, new RegExp(stage));
  assert.match(source, /Elapsed time:/);
});
