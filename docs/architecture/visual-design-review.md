# Visual design review loop

Visual quality is a separate acceptance boundary after canonical construction and rendering. The authenticated `POST /api/v2/ai/visual-review` endpoint requires front, side, and back data-URL renders, the original request, a bounded canonical outfit summary, and an attempt number from one to three.

The vision reviewer acts as a design director rather than a schema validator. It scores silhouette, proportions, plausible construction, material realism, seams/details, fit/clipping, prompt faithfulness, and commercial appeal from visible evidence only. It returns small typed repair directives against stable item IDs and named geometry/material groups. A high average cannot hide a critical defect.

The caller owns the render loop:

1. Render the canonical outfit from front, side, and back.
2. Submit all views with the same generation ID and current attempt.
3. On `repair`, apply only the returned named-group repairs, preserve unrelated and user-requested items, render again, and increment the attempt.
4. On `accept`, expose the result as visually accepted.
5. On `manual_review`, stop automatic mutation and retain the evidence and failure reasons for human review.

Automatic review is capped at three attempts. The gate accepts only an average score of at least 86 with no critical repair. This prevents an unbounded AI loop, silent garment substitution, and a technically complete but visibly poor result being reported as final.
