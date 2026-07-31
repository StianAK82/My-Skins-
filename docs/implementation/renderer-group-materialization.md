# Renderer group materialization

## Active path

`Create.tsx` parses the canonical outfit and projects it once to `PreviewSceneSpec`. `AvatarPreview` now receives that scene, suppresses its legacy garment primitives, and mounts `CanonicalConstruction` inside `avatar-root`. Each construction group owns a real Three.js geometry and material. The renderer then derives `Box3` measurements from those live objects and reports acceptance back to Create. Export continues to select `avatar-root`, so accepted construction is included in GLB output.

## Classification

| Family / groups | Status |
| --- | --- |
| Hoodie `hood`, `hood_opening`, `hood_fold`, `shoulders`, `sleeves`, `body_shell`, `cuffs`, `waistband`, `drawstrings`, pocket or divided front and zipper | RENDERED_FROM_CANONICAL_GEOMETRY |
| Bomber shell, rib collar/cuffs/waistband, zipper | RENDERED_FROM_CANONICAL_GEOMETRY |
| Blazer shell, left/right lapel, shoulders, opening, buttons, hem | RENDERED_FROM_CANONICAL_GEOMETRY |
| Puffer shell, sleeves, six quilt sections | RENDERED_FROM_CANONICAL_GEOMETRY |
| Cargo legs, waistband, left/right pockets, seams, hems | RENDERED_FROM_CANONICAL_GEOMETRY |
| Shoes left/right, soles, uppers, toe boxes, heels, tongues, laces | RENDERED_FROM_CANONICAL_GEOMETRY |
| Hair front, left/right sides, rear and crown | RENDERED_FROM_CANONICAL_GEOMETRY |
| Existing avatar body, face, skin and cosmetic slots | RENDERED_BY_LEGACY_APPROXIMATION |
| Fabric color/roughness and metal/rubber distinctions | MATERIAL_ONLY |
| Canonical kinds without a construction profile | UNSUPPORTED |

## Evidence and limitations

The acceptance report records generation and stable item IDs, expected and rendered dimensions, world positions, material names, triangle counts, missing groups and pass/fail. Measurements use `Box3.setFromObject` after world matrices update. Named meshes are relative to deterministic head, neck, torso, waist, leg and foot anchors. Resources are memoized per scene and disposed when replaced.

The current materializer intentionally uses low-cost boxes, so folds and rounded silhouettes remain stylized rather than production sculpted. Browser screenshot acceptance still belongs in the Chromium CI job; unit evidence is not represented as visual evidence.
