# Visual evidence

Playwright renders the real Create route through its managed preview server at desktop and narrow-mobile viewports. Evidence is written beneath `test-results/screenshots`; CI uploads screenshots, diffs and the report even on failure. Current tests verify a non-empty canvas, stable UI, no unexpected API traffic, and responsive layout. Primitive geometry remains preview-only. Side/back golden coverage is not yet exhaustive and is tracked as a repository limitation.
