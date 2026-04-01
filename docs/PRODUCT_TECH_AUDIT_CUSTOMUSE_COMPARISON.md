# My Skins vs Customuse — Product & Technical Audit

Date: 2026-04-01
Scope: `artifacts/my-skins` frontend + `artifacts/api-server` backend.

## 1) Summary

My Skins is still a **prototype with several production-shaped components**, not a production-grade product. The app has an AI generation pipeline, a Fabric.js editor, a credit/payments flow, and a basic 3D preview shell, but multiple core systems degrade into placeholders/fallback behavior at exactly the moments users expect reliable results.

Compared with Customuse’s polished visual-first flow, My Skins currently has three hard product gaps:

1. **Output reliability gap**: AI generation tolerates partial failures by returning `null` region assets and then drawing fallback shapes, which can look like fake results rather than true designed garments.
2. **Editor power gap**: module system is static and primitive (simple circles/rectangles/stripes), with no asset packs, snapping, parametric modules, or template-aware smart placement.
3. **Preview realism gap**: “3D preview” renders a generic box mesh with no garment texture mapping, so it is not a meaningful avatar-wearability validator.

If your benchmark is “feels like Customuse,” My Skins currently fails first-use trust: users can complete a flow, but outcomes are often low-confidence and visually underwhelming.

---

## 2) Detailed analysis

### Part 1 — Current system analysis

#### 1. AI system

**How implemented**
- Backend route family: `/ai/generate-outfit`, `/ai/generate-variants`, `/ai/remix-outfit`, `/ai/generate-listing`, `/ai/history`.
- Plan generation uses `openai.chat.completions.create` with model `gpt-5.2`, JSON-object mode, then validates via Zod (`outfitConceptSchema`).
- Region images use `openai.images.generate` (`gpt-image-1`) per region (front/back/left/right), then normalized into PNG data URLs.

**Prompt structure quality**
- Plan prompt includes broad stylistic constraints and a key list requirement but remains text-heavy and only loosely enforces template mapping quality.
- Visual prompts are generic (“clean visual asset”, “transparent background”, “no brand names”) but do not explicitly enforce seam continuity and exact template anchoring.

**Output parsing/validation**
- Better than typical prototypes: route validates request + response shape with Zod.
- But image generation failure is swallowed into a “valid” object with all `assets` fields null, so semantic failure still passes schema.

**Reliability / actual usability for skins**
- Reliability is medium at best: if image generation fails for any/all regions, backend still returns success payload and frontend applies fallback geometric layers.
- Result: users can see “something” even when AI failed to generate true region art.

**Bottom line**: schema correctness exists; design correctness is not guaranteed.

#### 2. Editor

**Fabric.js usage**
- Full Fabric canvas with selection, transform, text, primitive shapes, brush, uploads, zoom, z-order changes, lock/unlock, delete.

**Layer system**
- No dedicated layer panel model; layers are implicit via Fabric objects and minimal `data.layerName` metadata.
- Reordering is single-step forward/backward only.

**Module support**
- Static `MODULE_LIBRARY` hardcoded in frontend with ~12 simple pseudo-modules.
- Modules are rendered as primitive rect/circle/stripe objects, not reusable parametrized garment components.

**Usability / missing features**
- Missing snapping/grid, alignment tools, region masking/constraints, history stack (undo/redo visible), smart duplication patterns, grouped module editing, and true clothing part templates.

**Bottom line**: capable toy editor; not a production creator/editor stack.

#### 3. AI → canvas flow

**Does AI create visible designs?**
- Sometimes yes (when region assets return).
- If assets missing/fail, fallback shapes are injected per zone, ensuring non-empty canvas but not true generated clothing visuals.

**Where pipeline breaks**
- Breakpoint 1: image generation can fail and is normalized to null assets.
- Breakpoint 2: canvas apply step catches asset errors and silently substitutes generic stripe/emblem fallback.

**Apply-to-canvas correctness**
- Technically “working” because it always attempts to place something.
- Product-wise misleading: system may present success toast despite partially synthetic fallback output.

#### 4. Frontend UX

**Start → design → preview → export flow**
- Dashboard supports creation mode, item type, style preset, avatar/body metadata; AI generation creates project then redirects to editor.
- Editor has tabs for tools/modules/AI and preview dialog.

**Friction points**
- Users cannot clearly tell when output is true AI art vs fallback placeholders.
- AI panel uses generic prompt textarea and style chips; insufficiently guided for high-quality garment prompts.
- Multiple creation modes exist, but manual/template/remix UX feels thinly differentiated.

**Missing steps**
- No guided “publish readiness” checks (front/back completeness, contrast, seam quality).
- No guided marketplace listing flow integrated into editor completion journey.

#### 5. Avatar preview

**Implementation correctness**
- Dynamic import fallback logic is resilient.
- But 3D mode displays a plain box mesh with solid color material and `map={null}`; texture URL is ignored in 3D path.

**Crash/failure handling**
- Good fallback to 2D image if modules fail.

**Usefulness**
- 3D preview is currently non-functional as clothing preview (no mapped garment texture), so user validation value is low.

#### 6. Roblox integration

**Upload flow**
- Endpoint validates auth + project + credits, decrements credits transactionally, returns simulated `robloxAssetId`.

**OAuth readiness**
- App has auth/OIDC for app login, but no true Roblox OAuth upload handshake in this code path.

**Reliability**
- Transaction handling for credits is decent; Roblox upload itself is mock/simulated, not platform-integrated.

#### 7. Monetization

**Credit system**
- Credits stored on user; `/credits` route returns balance and fixed price unit.
- Upload consumes 1 credit.

**Payment flow**
- Stripe checkout + webhook increments credits and logs transactions.

**Integration quality**
- Functional baseline with idempotency check on purchase transaction.
- Limited commercial depth: single SKU, no bundles/tiering/subscriptions, no robust billing UX.

---

### Part 2 — Direct comparison to Customuse

> Comparison basis: code-level observed My Skins behavior vs requested Customuse benchmark capabilities (AI text-to-skin, visual-first workflow, strong editor/modules, avatar 3D preview).

1. **First impression**
   - Customuse: polished product feel.
   - My Skins: ambitious prototype with production framing but visible placeholder mechanics.

2. **AI experience**
   - Customuse-style expectation: consistently design-ready outputs.
   - My Skins: mixed consistency due to image-failure fallback substitution and generic prompting.

3. **Design workflow speed/clarity**
   - My Skins can be fast in clicks, but quality verification burden is pushed to user.
   - Lacks confidence-building UX checkpoints found in mature visual creators.

4. **Visual output reliability**
   - Biggest gap: My Skins can return visually non-empty but semantically weak outputs (fallback stripes/circles).

5. **Editor power**
   - Customuse benchmark implies modular asset-driven editing.
   - My Skins modules are hardcoded primitives with no data-driven pack system.

6. **Preview system**
   - Customuse benchmark: meaningful on-avatar preview.
   - My Skins: 3D preview is currently a box placeholder; practical validation mainly 2D.

7. **Product completeness**
   - Missing: real Roblox publish integration, true garment-aware 3D renderer, robust module/preset ecosystem, and strict AI quality gates before “success.”

---

### Part 3 — Top 10 critical issues

1. **AI success can represent failure**: backend returns success even when all region images fail (`assets: null`), undermining trust.
2. **Fallback masks core failure**: canvas substitutes generic shapes, so users receive fake completeness.
3. **3D preview is not true preview**: no texture map applied in 3D, making preview largely cosmetic.
4. **Module system is not modular**: static primitives instead of reusable garment component architecture.
5. **No strict generation quality gate**: no minimum acceptance checks before presenting “generated” outcome.
6. **Prompting insufficiently template-constrained**: region descriptions are loose; seam/continuity constraints under-specified.
7. **Manual workflow lacks pro tooling**: no snapping, alignment, region locks/masks, or composition aids.
8. **Roblox upload is simulated**: no genuine publishing pipeline, so end-to-end promise is unmet.
9. **Monetization before reliability**: charging credits for upload in a pipeline with placeholder preview undermines perceived fairness.
10. **Product messaging overstates maturity**: UI language implies robust “engine,” but actual output path still depends on safety fallbacks.

---

### Part 4 — Prioritized fix roadmap

#### Phase 1 (must fix immediately)

1. **Convert AI generation to hard-fail on empty assets**
   - Change: return 422 when required region assets missing (or mark explicit degraded status).
   - Where: `artifacts/api-server/src/routes/ai.ts` in `buildOutfitResult` + route responses.
   - Why: prevents false-positive “success.”

2. **Expose quality status in response contract**
   - Change: add `generationStatus` (`complete|partial|failed`) + per-region diagnostics.
   - Where: API schema + frontend `AiPanel`/Editor apply flow.
   - Why: users must know output integrity.

3. **Stop fallback-as-default success UX**
   - Change: fallback layers only under explicit user opt-in (“Use placeholder draft”).
   - Where: `applyAiOutfitToCanvas` in `Editor.tsx`.
   - Why: avoids misleading results.

4. **Fix 3D preview to display texture**
   - Change: load texture from `textureUrl` and map onto region-correct mesh/material.
   - Where: `AvatarPreview.tsx`.
   - Why: preview must validate wearability.

#### Phase 2 (core product quality / MVP)

5. **Introduce template-aware AI output schema**
   - Change: structured region directives (position/scale/repeat/symmetry/seam hints).
   - Where: AI prompts + Zod schemas in `ai.ts` + client types.
   - Why: raises consistency.

6. **Build real layer manager panel**
   - Change: named layers list, visibility toggle, lock, drag reorder, group operations.
   - Where: `Editor.tsx` UI + state around Fabric object metadata.
   - Why: critical for non-trivial designs.

7. **Upgrade manual builder ergonomics**
   - Change: grid/snapping, alignment guides, constrained transforms by template zones.
   - Where: Fabric canvas configuration + editor controls.
   - Why: faster, cleaner output.

8. **Implement actual Roblox integration path**
   - Change: replace simulated asset IDs with real API handshake/upload flow and status polling.
   - Where: `routes/roblox.ts` + new integration service module.
   - Why: fulfills product promise.

#### Phase 3 (competitive with Customuse)

9. **Data-driven module marketplace**
   - Change: module packs with metadata, tags, categories, variants, premium gating.
   - Where: DB schema + API + editor module browser.
   - Why: depth and retention.

10. **Generation-to-listing assistant flow**
   - Change: single publish wizard (generate → refine → preview → listing copy → upload).
   - Where: Dashboard + Editor + listing endpoint UX.
   - Why: end-to-end product polish.

11. **Variant ranking + smart recommendations**
   - Change: objective scores (contrast, readability, seam quality) and best-pick suggestion.
   - Where: AI response enrichment + frontend variant UI.
   - Why: reduces user decision fatigue.

---

### Part 5 — AI system improvement plan

#### Prompt structure (fix)
- Use explicit machine-first schema instructions with region-level constraints.
- Force concise fields, bounded arrays, hex palette validation, and seam continuity notes.

#### Output schema (fix)
- Add required fields:
  - `generationStatus`
  - `regions.front/back/leftSleeve/rightSleeve` each with `prompt`, `asset`, `confidence`, `fallbackUsed`
  - `validation` block with failures/warnings.

#### Validation strategy (fix)
1. Validate model JSON via Zod.
2. Validate each image payload (`png`, min dimensions, alpha, non-empty histogram).
3. Reject or mark partial before returning.
4. Add one repair pass only if structurally invalid.

#### Frontend handling (fix)
- If `generationStatus !== complete`, show “Resolve issues” modal, not green success toast.
- Offer user action: regenerate failed regions or accept placeholders explicitly.

#### Example

**Bad current outcome (conceptual)**
```json
{
  "concept": { "title": "Flame Shirt", "colorPalette": ["#111111", "#ff5500", "#ffffff"] },
  "assets": { "frontImage": null, "backImage": null, "leftSleeveImage": null, "rightSleeveImage": null }
}
```

**Correct structured outcome**
```json
{
  "generationStatus": "partial",
  "concept": {
    "title": "Flame Shirt",
    "target": "classic_shirt",
    "baseColor": "#111111",
    "colorPalette": ["#111111", "#ff5500", "#ffffff", "#2a2a2a"]
  },
  "regions": {
    "front": { "asset": "data:image/png;base64,...", "confidence": 0.92, "fallbackUsed": false },
    "back": { "asset": null, "confidence": 0.21, "fallbackUsed": false },
    "leftSleeve": { "asset": "data:image/png;base64,...", "confidence": 0.84, "fallbackUsed": false },
    "rightSleeve": { "asset": null, "confidence": 0.18, "fallbackUsed": false }
  },
  "validation": {
    "warnings": ["back region failed image generation", "right sleeve failed image generation"],
    "blocking": false
  }
}
```

---

### Part 6 — Manual builder gap and module system design

#### What is missing now
- No real module data model.
- No asset library (SVG/PNG decals, stitch patterns, trims, pockets, collars) with searchable metadata.
- No module parameters (size style variants, mirrored pair behavior, edge anchoring).
- No zone-aware placement constraints.

#### Proper module system (target design)

1. **Module entity model**
   - `id`, `name`, `category`, `assetType`, `defaultAsset`, `variants[]`, `anchors[]`, `allowedZones[]`, `premium`, `tags[]`.

2. **Placement engine**
   - Snap modules to zone anchors (chest center, sleeve band, hem line).
   - Optional auto-mirror for left/right sleeves or legs.

3. **Parametric controls**
   - Scale, rotation limits, color slots, stroke slots, blend mode.

4. **Pack system**
   - Starter pack (free), thematic packs (anime, military, cyber), creator packs.

5. **Editor UX**
   - Asset browser with search/filter, drag-preview ghost, one-click pair placement, quick variants.

6. **Serialization**
   - Store module instance graph in canvas metadata for deterministic re-editing/export.

---

### Part 7 — Final verdict

1. **Prototype or real product?**
   - **Prototype (advanced prototype), not yet a truly production-grade creator product.**

2. **One biggest blocker**
   - **Trust gap in AI output integrity**: success states are shown even when core generation fails and placeholders are substituted.

3. **Fastest path to Customuse-level experience**
   - Implement a strict “generation integrity” pipeline + true textured 3D preview + data-driven module library in that order. This sequence most rapidly converts user perception from “demo” to “real tool.”
