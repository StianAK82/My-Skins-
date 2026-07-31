# Active UniversalOutfitSpec flow

## Replaced flow

`Create.tsx` previously normalized AI output into `OutfitPlan`, inferred garments from prompt strings, mapped legacy accessory strings, built capability lists, revised the legacy plan, and exported browser textures without consulting canonical capabilities.

## Active flow

1. `POST /api/ai/generate` asks the model for strict `universalItems` alongside non-authoritative artwork metadata.
2. `modelItemsToUniversalOutfitSpec` strictly validates model item IDs/categories/colors, rejects duplicates and one-piece conflicts, routes every item through `ASSET_REGISTRY`, evaluates faithfulness and quality, and records bounded repair evidence.
3. The endpoint returns `outfitSpec` and a canonical lifecycle. Older design fields contain artwork descriptions only and make no preview, revision, support, lifecycle, or export decision.
4. `Create.tsx` strictly parses and stores `UniversalOutfitSpec`. Child-facing lists use `toCreatePresentation`; renderer props use read-only `toAvatarPreviewOutfit`; rendering data uses `toPreviewSceneSpec`.
5. Revisions reconcile candidates by stable identity, record changed paths, preserve unrelated items, and rerun validation, routing, and quality.
6. Classic compilation and browser delivery fail closed on canonical quality and compile only item IDs carrying `classic_shirt` or `classic_pants` capability.

## Legacy fixture boundary

`LegacyOutfitPlan` and deprecated `legacyToUniversalOutfitSpec` are not called by active generation or Create. They exist only for retained pre-migration rows and deterministic historical/browser fixtures. Remove them after the final legacy row passes `retentionUntil` and fixtures are stored as canonical specs.
