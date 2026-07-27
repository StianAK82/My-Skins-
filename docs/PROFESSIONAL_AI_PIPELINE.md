# Professional clothing generation pipeline

My Skins treats image AI as a **material artist**, never as a pattern maker. One immutable Outfit DNA passes through all five stages and deterministic garment templates own construction.

1. **Intent understanding** — the low-temperature GPT-4o-mini classifier normalizes child language. A deterministic normalizer provides a safe kid-focused Roblox intent if text AI is unavailable.
2. **Fashion planner** — `planOutfitDNA` combines intent with stored fashion knowledge. It freezes palette, fabric, lighting, stitches, folds, roughness, graphics, and a reproducible seed once per outfit.
3. **Material generator** — GPT Image receives blank UV islands and a surface-only contract for weave, wrinkles, subtle shading, print, and requested wear. The prompt explicitly prohibits garment construction.
4. **Garment constructor** — procedural atlas drawing applies every required module from the garment library after the material image returns. Module data supports position, scale, curvature, depth, normals, shadow, highlight, and edge wear.
5. **Quality inspector** — validates required-module evidence, PNG dimensions, UV coverage, and material variation before preview. A failure retries only the material request; intent and Outfit DNA remain unchanged.

## Garment library

`garment-library.ts` is the source of truth for hoodie, crew neck, T-shirt, zip hoodie, jeans, cargo pants, joggers, and football jersey construction. Each record owns required/optional modules, UV anchors, shadow/fold presets, fabric defaults, gravity behavior, and tailoring rules. Adding a garment means adding a record and its procedural module renderer—not changing an image prompt.

## Learning policy

Only accepted generation feedback is eligible for aggregate learned instructions. Repeated issues must reach the configured sample threshold before becoming prompt adjustments; rejected outputs are retained for diagnosis but never promoted as references. Quality reference images remain curated per garment.

## Rendering contract

The atlas uses a single top-left light direction and shared shadow intensity. The preview consumes the constructed texture, so deterministic contact shading, seam depth, folds and fabric micro-variation remain aligned across Roblox body faces. Future 3D preview upgrades should preserve this DNA while adding soft key/fill lighting, ambient occlusion, contact shadows, and classic Roblox body proportions.
