# Avatar and garment visual audit

## Active path

`UniversalOutfitSpec` is parsed in `Create`, projected by `toPreviewSceneSpec`, and adapted by `toAvatarPreviewOutfit` into `AvatarPreview`. The preview uses repository-owned procedural rounded meshes from `assets.ts`; no external model or unverified asset is loaded. The active body remains performant and has articulated R15 upper/lower limbs, rounded shoulder transitions, a separate neck, balanced torso/hips, and stable slot anchors. The block body is retained as the explicit compatibility fallback.

## Findings and changes

Previously, the adapter collapsed zip hoodies into hoodies, jerseys into T-shirts, coats and formal jackets into generic jackets, and every trouser into pants. This was a legacy rendering assumption and made requested silhouettes unverifiable. The scene projection also discarded category, material, placement, and layer data. It now preserves those properties and stable IDs. Distinct render selectors now survive through the active preview for zip hoodie, jersey, formal jacket, winter coat, jeans, joggers, and cargo pants. Cargo trousers add bilateral thigh pockets; zip garments have a divided placket; hoodie-only kangaroo pockets are no longer incorrectly placed on zip hoodies.

Existing dress geometry is a single bodice/bell-skirt silhouette and deliberately suppresses a skirt overlay. Shoes and boots already render separately on both terminal leg parts with sole, upper, toe/heel treatment; boots have a taller shaft. Existing asset registry cosmetics use stable slot anchors and paired procedural parts.

## Fit and acceptance

`visual-quality.ts` adds deterministic, non-destructive conflict records for hair/headwear, hood/hair, shared back anchors, crown/hair, and bag/outerwear. Every record carries severity, stable IDs, measured overlap, bounded correction, preserved properties, and unresolved reason. The visual gate scores twelve required dimensions and treats missing items and unsupported footwear as critical. Bounded repair never fabricates or removes a requested item and accepts a patch only on score improvement.

## Remaining rendered validation

Procedural geometry is the chosen documented fallback; a repository-owned authored GLB remains a future enhancement. Browser screenshots are evidence only when Playwright runs successfully. CI installs and verifies Chromium on a GitHub-hosted runner and uploads screenshots, diffs, and failure reports. Local HTTP 403 browser installation must not be reported as visual success.
