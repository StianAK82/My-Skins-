# Construction-to-geometry map

The active canonical preview projection now compiles construction metadata into deterministic, named geometry groups and attaches its measurement report to each `PreviewSceneSpec` item. Preview acceptance must use `geometryVerification.passed`; a metadata string alone is never evidence.

## Status legend

- **VERIFIED_GEOMETRY**: named output and deterministic measurement exist.
- **IMPLEMENTED_UNMEASURED**: renderer detail exists but is not measured.
- **METADATA_ONLY**: canonical field has no output (verification rejects it).
- **MISSING**: neither canonical field nor output exists.

## Core traceability

| Profile          | Canonical fields                                                                                                                                            | Renderer/compiler output                                                                                                          | Measurement                                                       | Required views      | Status            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------- | ----------------- |
| regular hoodie   | hood depth/width/height/opening/fold, shoulder drop, sleeve volume, fabric thickness, cuff/waistband height, oversized amount, kangaroo pocket, drawstrings | `hood`, `hood_opening`, `hood_fold`, `shoulders`, `sleeves`, `body_shell`, `cuffs`, `waistband`, `kangaroo_pocket`, `drawstrings` | bounding-box axis for numeric fields; group existence for details | front + side        | VERIFIED_GEOMETRY |
| oversized hoodie | same hoodie fields, larger numeric profile                                                                                                                  | same groups with 0.58-wide hood, 0.16 shoulder drop, high sleeves and 0.22 oversize                                               | bounding boxes and parameter equality                             | front + side        | VERIFIED_GEOMETRY |
| zip hoodie       | hoodie fields plus zipper and divided front; no automatic pocket                                                                                            | `zipper`, `front_left`, `front_right` plus hoodie groups                                                                          | group existence, front separation                                 | front + side        | VERIFIED_GEOMETRY |
| bomber           | rib collar/cuffs/waistband, zipper, cropped body, rounded volume                                                                                            | like-named groups and `body_shell`                                                                                                | group existence                                                   | front + side        | VERIFIED_GEOMETRY |
| blazer           | lapels, shoulders, opening, buttons, formal hem                                                                                                             | like-named groups                                                                                                                 | group existence                                                   | front               | VERIFIED_GEOMETRY |
| puffer           | inflated/heavy shell, six quilt sections, thick sleeves                                                                                                     | `inflated_shell`, six `quilt_sections:*`, `thick_sleeves`                                                                         | group count and existence                                         | front + side        | VERIFIED_GEOMETRY |
| cargo pants      | two side pockets, waistband, relaxed legs, seams, hems                                                                                                      | paired `side_pockets:*` and named groups                                                                                          | count, symmetry positions, existence                              | front + side        | VERIFIED_GEOMETRY |
| sneakers         | pair, sole, upper, toe, heel, tongue, laces                                                                                                                 | two `shoes:*` plus component groups                                                                                               | count, left/right positions, existence                            | front + side        | VERIFIED_GEOMETRY |
| supported hair   | front, side, rear, crown clearance; long hair shoulder clearance                                                                                            | `hair_front`, `hair_sides`, `hair_back`, `hair_crown`                                                                             | group existence and clearance bounding boxes                      | front + side + back | VERIFIED_GEOMETRY |

Every output group records material assignment and triangle count. A missing group produces a `null` measurement and a child-facing limitation. Numeric evidence uses actual group bounds with a ±0.015 tolerance rather than confidence scores.

## Acceptance and repair

`verifyConstructionGeometry` requires both the canonical key and matching geometry. Counted features (pockets, shoes, quilting) use mesh counts. Bounded repair selects only failed named groups on the same stable item ID, records complete before/after evidence, preserves unrelated groups, and accepts only an increased pass count.

## Current visual evidence limitation

The deterministic compiler and preview projection are verified in Node tests. Existing React Three Fiber primitives visually implement several corresponding groups, but CI screenshots have not yet been captured for this milestone. They must not be described as current visual proof. The next milestone is **Renderer Group Materialization and CI Multi-view Evidence**: consume every compiled named group in the React renderer, make geometry verification a UI acceptance gate, and capture the required front/side/back manifest.
