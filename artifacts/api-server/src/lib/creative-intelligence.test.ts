import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  buildConceptDivergencePrompt,
  buildConceptSelectionPrompt,
  buildCreativeCarryThroughCorrection,
  buildCreativeDirectionForBuilder,
  chooseCreativeStrategy,
  evaluateCreativeCarryThrough,
  rankFinalists,
  type RefinedConcept,
} from "./creative-intelligence";

function finalist(
  id: string,
  childWow: number,
  originality: number,
): RefinedConcept {
  return {
    id,
    title: "The Last Dragon Knight",
    story:
      "An ancient guardian carries the final blue dragon flame into battle.",
    audienceInsight:
      "Large glowing forms create an immediate powerful fantasy for children.",
    silhouette: {
      primaryShape: "Broad triangular shoulders over a narrow armored waist",
      largeForms: ["dragon pauldrons", "sweeping split cape"],
      secondaryForms: ["heavy boots", "segmented gauntlets"],
      asymmetry: "One pauldron has a longer dragon horn",
      thumbnailRead: "Black triangle with a bright blue sword line",
    },
    heroElement: {
      name: "Living Dragon Pauldrons",
      description: "Black dragon heads whose eyes channel blue magical light",
      bodyLocation: "both shoulders",
      memoryHook: "The armor looks alive and protects its final knight",
    },
    palette: ["#111827", "#D4AF37", "#3B82F6"],
    materials: ["blackened steel", "engraved gold"],
    garmentDirection: ["fitted plated torso", "heavy armored boots"],
    accessoryDirection: ["long split cape", "glowing rune sword"],
    textureDirection: ["restrained scratches", "blue rune channels"],
    explicitRequirements: ["knight"],
    improvements: [
      "Enlarge the shoulder silhouette",
      "Reduce minor chest decoration",
    ],
    critique:
      "Strong readable idea with one memorable feature and controlled detail.",
    internalPreferenceSignals: {
      promptFaithfulness: 95,
      childWow,
      silhouetteStrength: 92,
      heroElementStrength: 96,
      storytelling: 90,
      originality,
      robloxReadability: 88,
      buildability: 70,
    },
  };
}

test("internal preference ranking prioritizes child delight without publishing a skin score", () => {
  const bold = finalist("concept-07", 98, 94);
  const generic = finalist("concept-02", 65, 50);
  const ranked = rankFinalists([generic, bold]);
  assert.equal(ranked[0].concept.id, "concept-07");
  assert.equal("score" in ranked[0], false);
});

test("taste ranking is deterministic and selects the strongest finalist", () => {
  const ranked = rankFinalists([
    finalist("concept-03", 82, 80),
    finalist("concept-07", 98, 94),
    finalist("concept-01", 72, 65),
  ]);
  assert.equal(ranked[0].concept.id, "concept-07");
  assert.ok(ranked[0].preference > ranked[1].preference);
});

test("creative breadth adapts to request openness and revisions skip divergence", () => {
  assert.deepEqual(chooseCreativeStrategy({ prompt: "Hvit hettegenser" }), {
    conceptCount: 3,
    finalistCount: 1,
    mode: "focused",
  });
  for (const prompt of [
    "Lag verdens kuleste ridder",
    "Lag en rå prinsesse",
    "Design an epic pirate",
    "Create an awesome robot",
    "Lag en original edderkoppinspirert superhelt",
  ]) {
    assert.deepEqual(chooseCreativeStrategy({ prompt }), {
      conceptCount: 8,
      finalistCount: 3,
      mode: "exploratory",
    });
  }
  assert.equal(
    chooseCreativeStrategy({
      prompt: "Gjør vingene større",
      previousOutfit: {},
    }),
    null,
  );
});

test("director prompts enforce divergence, taste, silhouette and a hero element before assets", () => {
  const divergence = buildConceptDivergencePrompt({
    prompt: "Lag verdens kuleste ridder",
    conceptCount: 8,
  });
  assert.match(divergence, /exactly 8 genuinely different/i);
  assert.match(divergence, /silhouette-first/i);
  assert.match(divergence, /hero element/i);
  assert.match(divergence, /do not choose registry assets/i);

  const selection = buildConceptSelectionPrompt({
    prompt: "Lag verdens kuleste ridder",
    concepts: [finalist("concept-07", 98, 94)],
    finalistCount: 3,
  });
  assert.match(selection, /independent Design Taste Jury/i);
  assert.match(selection, /Select the 3 strongest/i);
  assert.match(selection, /Penalize generic costume checklists/i);
});

test("winning direction gives the builder story and form hierarchy, not just item labels", () => {
  const direction = buildCreativeDirectionForBuilder(
    finalist("concept-07", 98, 94),
  );
  assert.match(direction, /The Last Dragon Knight/);
  assert.match(direction, /Primary silhouette/);
  assert.match(direction, /Living Dragon Pauldrons/);
  assert.doesNotMatch(direction, /score|92\/100|93\/100/i);
  assert.match(direction, /instead of silently substituting a generic hoodie/i);
});

test("carry-through gate requires palette, hero element, and form or material evidence", () => {
  const selected = finalist("concept-07", 98, 94);
  const faithfulBuild = {
    colorPalette: ["#111827", "#D4AF37", "#3B82F6"],
    designElements: ["Living dragon pauldrons with luminous eyes"],
    universalItems: [
      { kind: "armor", material: "blackened steel", label: "Dragon armor" },
    ],
  };
  assert.deepEqual(evaluateCreativeCarryThrough(selected, faithfulBuild), {
    passed: true,
    evidence: { palette: true, heroElement: true, silhouetteOrMaterial: true },
    missing: [],
  });

  const genericBuild = {
    colorPalette: ["#808080"],
    designElements: ["generic armor"],
    universalItems: [{ kind: "armor", material: "fabric" }],
  };
  const failed = evaluateCreativeCarryThrough(selected, genericBuild);
  assert.equal(failed.passed, false);
  assert.deepEqual(failed.missing, [
    "selected palette",
    "hero element",
    "silhouette or material direction",
  ]);
  assert.match(
    buildCreativeCarryThroughCorrection(selected, failed),
    /actual universalItems, materials, designElements, placement, modules/i,
  );
});

test("visual benchmark permanently covers seven materially different design families", () => {
  const suite = JSON.parse(
    readFileSync(
      new URL(
        "../../quality-tests/creative-intelligence-suite.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    cases: Array<{
      id: string;
      expectedMode: string;
      requiredEvidence: string[];
    }>;
  };
  assert.deepEqual(
    suite.cases.map((entry) => entry.id),
    [
      "creative-knight",
      "creative-ordinary-clothes",
      "creative-princess",
      "creative-pirate",
      "creative-robot",
      "creative-football-kit",
      "creative-original-spider-hero",
    ],
  );
  for (const entry of suite.cases) {
    assert.ok(entry.requiredEvidence.includes("front_design"));
    assert.ok(entry.requiredEvidence.includes("back_design"));
    assert.match(entry.expectedMode, /^(focused|exploratory)$/);
  }
  const spider = suite.cases.at(-1)!;
  assert.ok(spider.requiredEvidence.includes("no_protected_logo"));
  assert.ok(spider.requiredEvidence.includes("no_exact_costume"));
});
