import test from "node:test";
import assert from "node:assert/strict";
import { compileCreativeZoneArtwork, decideVisibleDesignStatus } from "../ai/creative-visible-design.ts";
import { compileRenderedConstruction, materialProfile } from "../ai/rendered-construction.ts";

const creative = { id:"knight", title:"Rune Warden", story:"A guardian", palette:["#111827","#2563EB","#D4AF37"], materials:["darkened metal","emissive accents"], heroElement:{name:"Blue rune core",bodyLocation:"chest"}, silhouette:{primaryShape:"broad heroic shoulders",largeForms:["heavy armored upper body"],secondaryForms:["angular boots"],asymmetry:"one bright shoulder"},textureDirection:["runes","wear"] };

test("selected concept changes measured silhouette and creates stable visible hero geometry", () => {
  const base = compileRenderedConstruction({ id:"top-1", kind:"hoodie", colors:["#777777"], size:"medium" });
  const designed = compileRenderedConstruction({ id:"top-1", kind:"hoodie", colors:creative.palette, size:"medium", material:"darkened metal", creative });
  assert.ok(designed.groups.find(group => group.name === "body_shell")!.width > base.groups.find(group => group.name === "body_shell")!.width);
  assert.equal(designed.groups.filter(group => group.parameters.hero).length, 1);
  assert.match(designed.groups.at(-1)!.name, /^hero:/);
});

test("material directions have visibly different renderer responses", () => {
  assert.ok(materialProfile("darkened metal with blue glow").metalness > materialProfile("soft grey fleece").metalness);
  assert.ok(materialProfile("soft grey fleece").roughness > materialProfile("polished metal").roughness);
  assert.equal(materialProfile("translucent fantasy crystal").transparent, true);
});

test("classic artwork is semantic and distinct per zone", () => {
  const layers = compileCreativeZoneArtwork(creative);
  assert.deepEqual(new Set(layers.map(layer => layer.zone)).size, 8);
  assert.notEqual(layers.find(layer => layer.zone === "front")!.name, layers.find(layer => layer.zone === "back")!.name);
  assert.ok(layers.some(layer => layer.name === "creative:hero-front"));
  assert.ok(layers.some(layer => layer.name === "creative:story-back"));
});

test("READY requires actual five-view, hero, geometry, material and export evidence", () => {
  const ready = decideVisibleDesignStatus({ supported:true,heroVisible:true,conceptVisible:true,silhouetteVisible:true,materialsReadable:true,frontBackCoherent:true,criticalClipping:false,missingRequestedItems:[],exportValid:true,allViewsRendered:true });
  assert.equal(ready.status,"READY");
  const repair = decideVisibleDesignStatus({ supported:true,heroVisible:false,conceptVisible:true,silhouetteVisible:true,materialsReadable:true,frontBackCoherent:false,criticalClipping:false,missingRequestedItems:[],exportValid:true,allViewsRendered:true });
  assert.deepEqual(repair,{status:"NEEDS_REPAIR",defects:["Hero element is not visible","Front and back are not coherent"]});
});
