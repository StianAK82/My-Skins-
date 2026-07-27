import assert from "node:assert/strict";
import test from "node:test";
import { garmentManifestSchema } from "./garment-manifest.ts";
import { GARMENT_FITS } from "./garment-fit.ts";
import { GARMENT_MATERIALS } from "./garment-materials.ts";
import { GARMENT_REGISTRY } from "./garment-registry.ts";
import { resolveGarmentManifest } from "./garment-resolver.ts";
import { validateRenderedOutfit } from "./garment-validation.ts";

const id="123e4567-e89b-42d3-a456-426614174000";
test("resolver builds strict, versioned manifests for the golden prompt matrix",()=>{
  const cases:Record<string,string[]>={"White hoodie skin":["hoodie","trousers","sneakers"],"Black T-shirt and blue jeans":["tshirt","jeans","sneakers"],"Red football uniform number 10":["football-jersey","shorts","football-boots"],"Green cargo outfit":["tshirt","cargo-pants","sneakers"],"Pink dress outfit":["dress","sneakers"],"Black zip hoodie and joggers":["zip-hoodie","joggers","sneakers"],"White formal suit":["jacket","trousers","sneakers"],"Blue winter coat outfit":["jacket","trousers","boots"],"Ninja outfit":["jacket","trousers","boots"],"Knight armour outfit":["jacket","trousers","boots"]};
  for(const [prompt,categories] of Object.entries(cases)){const manifest=resolveGarmentManifest(prompt,id);assert.deepEqual(manifest.metadata.previewGarments,categories);assert.equal(garmentManifestSchema.safeParse(manifest).success,true);}
});
test("one-piece composition excludes separate shells",()=>{const m=resolveGarmentManifest("pink princess dress",id);assert.ok(m.onePiece);assert.equal(m.top,undefined);assert.equal(m.bottom,undefined)});
test("registry is complete and slot/export mappings agree",()=>{for(const [key,value] of Object.entries(GARMENT_REGISTRY)){assert.equal(key,value.category);assert.ok(value.requiredModules.length);assert.ok(value.variants.length);assert.ok(value.materials.length);if(value.slot==="top")assert.equal(value.classicExport,"shirt");if(value.slot==="bottom")assert.equal(value.classicExport,"pants");if(value.slot==="footwear")assert.equal(value.classicExport,null);}});
test("families select distinct shells and hoodie geometry stays isolated",()=>{assert.equal(GARMENT_REGISTRY.hoodie.shell,"hoodie");assert.equal(GARMENT_REGISTRY.tshirt.shell,"top");assert.ok(!GARMENT_REGISTRY.tshirt.requiredModules.includes("hood"));assert.notEqual(GARMENT_REGISTRY.jeans.shell,GARMENT_REGISTRY["cargo-pants"].shell);assert.equal(GARMENT_REGISTRY.shorts.shell,"shorts");});
test("fits alter actual geometry and maintain a positive body offset",()=>{assert.ok(GARMENT_FITS.oversized.width>GARMENT_FITS.slim.width);assert.ok(GARMENT_FITS.oversized.sleeveWidth>GARMENT_FITS.slim.sleeveWidth);for(const fit of Object.values(GARMENT_FITS)) assert.ok(fit.bodyOffset>0)});
test("materials retain family-specific physical response",()=>{assert.ok(GARMENT_MATERIALS.denim.edgeContrast>GARMENT_MATERIALS["cotton-fleece"].edgeContrast);assert.ok(GARMENT_MATERIALS["cotton-fleece"].roughness>GARMENT_MATERIALS["performance-mesh"].roughness);assert.ok(GARMENT_MATERIALS.armour.metallic>.8);assert.equal(GARMENT_MATERIALS.armour.foldResponse,0)});
test("unsupported families expose fallback metadata instead of becoming hoodies",()=>{for(const prompt of ["black ninja tunic","blue winter coat","white blazer suit","knight armour"]){const m=resolveGarmentManifest(prompt,id);assert.ok(m.fallback.length>0);assert.notEqual(m.top?.category,"hoodie");}});
test("render validation rejects absent evidence, intersections, and forbidden geometry",()=>{const m=resolveGarmentManifest("black t-shirt and jeans",id);const invalid=validateRenderedOutfit(m,{top:{visible:new Set(["hood-silhouette"]),intersections:1,silhouetteId:"hood",projectionCoverage:1}});assert.equal(invalid.valid,false);assert.match(invalid.errors.join(" "),/missing collar-opening|forbidden hood-silhouette|intersections/)});
test("football selection retains coordinated complete outfit",()=>{const m=resolveGarmentManifest("red football uniform number 10",id);assert.equal(m.top?.variant,"numbered");assert.equal(m.bottom?.variant,"football");assert.equal(m.footwear?.category,"football-boots")});
