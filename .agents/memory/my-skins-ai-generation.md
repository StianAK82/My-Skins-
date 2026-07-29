---
name: My Skins AI design generation (gpt-5.2)
description: Why AI design generation returned HTTP 422, and how the token budget + JSON parsing are hardened.
---

## Reasoning-model token budget must be generous or JSON truncates
AI design generation (`api-server` ai-generation.service.ts, model `gpt-5.2` via the OpenAI integration) failed with HTTP 422 "AI returned non-JSON content". Root cause: `max_completion_tokens` was 1400. gpt-5.2 is a reasoning model — reasoning tokens count against that budget, so the visible JSON got cut off mid-string and `JSON.parse` threw.
**Why:** completion budget is shared between hidden reasoning and the actual output; a verbose schema (modules array + placement + editorInstructions) overruns a small budget.
**How to apply:** keep the budget generous (currently 6000) for this structured schema, and tell the model to stay compact (≤8 modules, ≤3 notes). If you add fields to the schema, re-check the budget.

## Hero image makes the prompt literal (July 2026)
User required that AI "actually makes what the text asks for". The module/plan system only
produces abstract shapes, so `/ai/hero-image` (ai-v2.ts) now generates the real artwork with
`gpt-image-1` (`background: "transparent"`, quality medium, ~20-30s) and the frontend adds it
as an `imageLayer` on the `front` zone after `applyAiPlan` (Create.tsx, `aiPhase` progress text).
**Gotcha:** the returned PNG can *look* like it has a painted backdrop in a viewer, but check
the alpha channel — with `background: "transparent"` it usually IS transparent. Also prompt
must forbid backdrops/glows/shadows explicitly or the model paints them into the subject halo.

## parseStrictJson is layered + tolerant of truncation
`parseStrictJson` tries: direct parse → fenced ```json``` block → first-brace..last-brace slice → `closeTruncatedJson` repair (closes open strings/brackets) as a last resort. Repaired output still must pass `JSON.parse` and is then sanitised by `normalizeDesignPayload` + `aiValidationService.ensureDesign` (which fill defaults for every field), so a partial salvage is safe.
**How to apply:** the budget fix is the real cure; the repair is a safety net. Don't rely on the repair for correctness — if you see the repair path firing often, the token budget is too low again.

## Themed outfits: teach recipes, never whitelist retries (July 2026)
Batch-testing ~30 prompts showed the model returned ALL-EMPTY outfits for any figure not explicitly listed in the prompt (knight, police, firefighter, doctor, robot, witch, king, santa …), even though listed themes (astronaut, ninja, dragon) worked.
**Why:** the model treats the enumerated themed-recipe list as exhaustive; unlisted figures fall back to the strict "only what was asked" rule and come back all-none.
**How to apply:** the themed rule now says ANY figure/profession/thing in ANY language means full outfit, plus iconic color recipes for common figures. The safety-net retry fires on a COMPLETELY empty outfit (top+bottom+shoes+accessories+customParts+hair all none/empty, no previousOutfit) — never a theme-regex whitelist, and shoes MUST be part of the emptiness check or shoes-only requests get clobbered by the retry. «bare/kun/only» single-piece rule is stated explicitly or the model pads with a t-shirt. Batch test script pattern: POST /api/ai/generate with semantic assertions per theme (see /tmp/skin-batch.mjs style).

## Realistic look (July 2026)
Users found procedural modules + one motif "just color changes". Fix: TWO parallel gpt-image-1 calls per skin — `kind:"fabric"` (opaque, full-bleed seamless material texture from theme/palette/designElements, applied edge-to-edge as imageLayer on all 8 shirt/leg zones, scale 1.6) + `kind:"motif"` (transparent chest logo). Motif prompt must tell the model NOT to draw the garment itself when the user names one (hoodie/genser) — otherwise it pastes a picture of a hoodie on the chest. Pants export reuses fabricUrl.
