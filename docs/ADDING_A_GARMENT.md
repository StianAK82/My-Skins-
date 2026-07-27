# Adding a garment type

1. Add the category to `garmentCategories` and one complete entry to `GARMENT_REGISTRY`. The entry is the single source for slot, variants, modules, materials, fit, Classic export mapping, validation evidence, fallback, and shell selection.
2. Reuse a `ShellKey` in `FullOutfitPreview`, or add one composable shell branch when the silhouette cannot be expressed by an existing family. Construction details belong in small geometry modules, not prompt parsing.
3. Add prompt vocabulary to the resolver only when intent recognition cannot already select the registry category. Unsupported requests must record explicit fallback metadata.
4. Add a validation profile based on observable projection/geometry evidence and a manifest fixture to the golden matrix. Include enhanced/classic front/back plus wireframe and UV-debug captures.
5. Confirm the Classic mapping remains `shirt`, `pants`, or `null`; geometry-assisted shells are preview-only and never advertised as a 3D export.
