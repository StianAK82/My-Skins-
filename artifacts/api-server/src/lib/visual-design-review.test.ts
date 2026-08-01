import assert from "node:assert/strict";
import test from "node:test";
import { buildVisualReviewPrompt, decideVisualReview, requiredVisualViews, visualDesignReviewSchema, visualReviewRequestSchema } from "./visual-design-review";

const request = () => ({ generationId:"generation-1",attempt:1,prompt:"rune knight",outfitSummary:"top-armor-01:armor",itemIds:["top-armor-01"],classicExportValid:true,views:requiredVisualViews.map(view=>({view,imageUrl:"data:image/png;base64,AA=="})) });
const observations = { selectedConceptVisible:true,heroElementVisible:true,silhouetteMatches:true,materialsReadable:true,frontBackCoherent:true,noCriticalClipping:true,noRequestedItemMissing:true,originalEnough:true,classicExportValid:true };

test("visual review requires exactly five named browser views and stable item IDs",()=>{
  assert.equal(visualReviewRequestSchema.safeParse(request()).success,true);
  assert.equal(visualReviewRequestSchema.safeParse({...request(),views:request().views.slice(0,4)}).success,false);
  assert.equal(visualReviewRequestSchema.safeParse({...request(),itemIds:[]}).success,false);
});
test("prompt bans numeric scoring and requires localized repairs",()=>{const prompt=buildVisualReviewPrompt(visualReviewRequestSchema.parse(request()));assert.match(prompt,/never return a numeric score/i);assert.match(prompt,/smallest affected existing group/i);});
test("READY requires every categorical observation",()=>{
  const ready=visualDesignReviewSchema.parse({status:"READY",observations,defects:[],repairs:[],summary:"All five views pass"});
  assert.equal(decideVisualReview(ready,1).status,"READY");
  const repair=visualDesignReviewSchema.parse({status:"NEEDS_REPAIR",observations:{...observations,heroElementVisible:false},defects:["Hero is hidden"],repairs:[{targetItemId:"top-armor-01",targetGroup:"hero:rune-core",issue:"Hero is hidden",operation:"adjust_proportions",instruction:"Enlarge only the rune core",severity:"major"}],summary:"Localized repair"});
  assert.equal(decideVisualReview(repair,1).status,"NEEDS_REPAIR");
  assert.equal(decideVisualReview(repair,3).status,"MANUAL_REVIEW");
});
