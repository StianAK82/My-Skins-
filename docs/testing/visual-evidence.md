# Visual evidence

Playwright renders the real Create route through its managed preview server at desktop and narrow-mobile viewports. Evidence is written beneath `test-results/screenshots`; CI uploads screenshots, diffs, traces and the HTML report even on failure. Current tests verify a non-empty canvas, stable UI, no unexpected API traffic, and responsive layout.

The representative run produces 82 screenshots: six fixed desktop views for each of 13 outfit cases, plus a narrow-mobile front view for the first four cases. `test-results/visual-evidence.json` records every prompt, camera view, viewport and artifact path. CI checks the manifest count and rejects missing or empty files before uploading the screenshot and report artifacts with 30-day retention. This prevents a green visual job from silently publishing an incomplete evidence set.

Primitive geometry remains preview-only. The uploaded evidence is the input to visual review; it is not itself proof that garment silhouettes, clipping or materials have passed review. Reviewers should download `my-skins-screenshots`, record the most visible issues, and use the same camera cases for before/after comparison in the geometry milestone.
