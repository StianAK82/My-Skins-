# Active UniversalOutfitSpec flow

## Replaced flow

`Create.tsx` previously called the generated `aiGenerateDesign` client, normalized the response into `OutfitPlan`, independently inferred garment presence from prompt strings, mapped accessory strings through local maps, built item/status lists, and retained `OutfitPlan` as revision authority. Browser-created shirt/pants textures were exported without consulting outfit capabilities.

## Active flow

1. `POST /api/ai/generate` validates the request and obtains the model's transitional structured output.
2. The single deprecated `legacyToUniversalOutfitSpec` boundary deterministically assigns stable IDs, enforces one-piece semantics, routes every item through `ASSET_REGISTRY`, records validation evidence and quality dimensions, and strictly parses the result.
3. The endpoint returns `outfitSpec` and an exact canonical lifecycle. The old design fields remain presentation/texture inputs only while retained generations expire.
4. `Create.tsx` strictly parses and stores `UniversalOutfitSpec`. Child-facing item/capability messages use only `toCreatePresentation`; renderer input uses only `toPreviewSceneSpec`.
5. Revisions reconcile changed candidates by stable category/item identity, record changed paths, preserve unrelated items and rerun the server canonical pipeline.
6. Classic rendering is fail-closed on the canonical quality gate and emits only capabilities explicitly marked `classic_shirt` or `classic_pants`.

## Temporary boundary and removal condition

`LegacyOutfitPlan` and `legacyToUniversalOutfitSpec` exist only because the current model prompt and retained generation rows use `aiOutfitSchema`. Remove both after the prompt emits `UniversalOutfitSpec` directly and the last legacy row has passed `retentionUntil`. No preview, item-list, lifecycle, revision-identity, or export-eligibility decision may be added to the legacy representation.
