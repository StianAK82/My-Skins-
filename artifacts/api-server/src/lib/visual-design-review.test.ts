import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVisualReviewPrompt,
  decideVisualReview,
  visualDesignReviewSchema,
  visualReviewRequestSchema,
} from "./visual-design-review";

const scores = (score: number) => ({
  silhouette: score,
  proportions: score,
  construction: score,
  materialRealism: score,
  seamsAndDetails: score,
  fitAndClipping: score,
  promptFaithfulness: score,
  commercialAppeal: score,
});

test("visual review requires front, side, and back evidence", () => {
  const parsed = visualReviewRequestSchema.safeParse({
    generationId: "generation-1",
    attempt: 1,
    prompt: "oversized hoodie",
    outfitSummary: "hoodie with hood fold",
    views: ["front", "side", "detail"].map((view) => ({
      view,
      imageUrl: "data:image/png;base64,AA==",
    })),
  });
  assert.equal(parsed.success, false);
  assert.match(parsed.error?.issues[0]?.message ?? "", /back/);
});

test("review prompt makes visual proof and real construction mandatory", () => {
  const request = visualReviewRequestSchema.parse({
    generationId: "generation-1",
    attempt: 1,
    prompt: "oversized hoodie",
    outfitSummary: "item top-hoodie-01, hood fold and kangaroo pocket",
    views: ["front", "side", "back"].map((view) => ({
      view,
      imageUrl: "data:image/png;base64,AA==",
    })),
  });
  const prompt = buildVisualReviewPrompt(request);
  assert.match(prompt, /Judge only visible evidence/);
  assert.match(prompt, /plausibly be sewn/);
  assert.match(prompt, /Commercial appeal/);
});

test("high scoring review passes while a critical defect fails closed", () => {
  const clean = visualDesignReviewSchema.parse({
    scores: scores(92),
    defects: [],
    repairs: [],
    summary: "Ready",
  });
  assert.deepEqual(decideVisualReview(clean, 1), {
    accepted: true,
    decision: "accept",
    score: 92,
    threshold: 86,
    attempt: 1,
    repairs: [],
    failureReasons: [],
  });

  const clipped = visualDesignReviewSchema.parse({
    scores: scores(94),
    defects: ["Hood clips through the hair"],
    repairs: [
      {
        targetItemId: "top-hoodie-01",
        targetGroup: "hood_shell",
        issue: "Hood clips through the hair",
        operation: "repair_clipping",
        instruction: "Increase rear clearance without changing the body shell",
        severity: "critical",
      },
    ],
    summary: "Repair the hood",
  });
  assert.equal(decideVisualReview(clipped, 1).decision, "repair");
  assert.equal(decideVisualReview(clipped, 1).accepted, false);
  assert.equal(decideVisualReview(clipped, 3).decision, "manual_review");
});
