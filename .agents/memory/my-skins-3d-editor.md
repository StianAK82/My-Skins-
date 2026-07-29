---
name: My Skins 3D editor preview & rendering
description: How the Roblox clothing 3D preview works, its WebGL/screenshot constraint, the dev auth affordance, and the decluttered editor layout.
---

## Product is now ONE single page (July 2026 radical simplification)
User ordered "fjern alt annet fra systemet": the entire multi-page app (Landing, Editor, Dashboard, Projects, Settings, Share, Payment pages, AuthGuard, Navbar/AppLayout, AiPanel) was DELETED. The whole product is `src/pages/Create.tsx` at route "/": 3 short how-to steps, one animated 3D avatar (`AvatarPreview` with `animated` prop → idle sway/bob via useFrame), one AI prompt input that generates and AUTO-applies the skin (clears old layers via deleteLayer loop, then setAiPlanPreview + applyAiPlan — Zustand sync updates make this safe), and one "Last opp til Roblox" button (exports PNG offscreen + opens create.roblox.com; no real Roblox Open Cloud upload yet — would need user's API key).
**Why:** user wants a dead-simple product: type text → AI makes the skin on the figure → upload. No tools, no login UI, no modes.
**How to apply:** do NOT reintroduce editor UI, drawers, save/load, or extra pages unless the user asks. New capabilities go into Create.tsx or behind the AI prompt.

## TS quirk: `THREE.Group`/`THREE.Object3D` types not resolvable in this repo
`tsc` errors "Namespace 'three' has no exported member 'Group'/'Object3D'" even though runtime `import * as THREE from "three"` works. Type refs for R3F object refs must use structural types (e.g. `useRef<{ rotation: { y: number } } | null>`).

## 3D preview cannot be verified via the screenshot tool
The Replit headless screenshot browser has **no GPU/WebGL** ("Could not create a WebGL context"). Any Three.js/R3F view fails there.
**Why:** sandbox limitation, not the app. Real user browsers render fine.
**How to apply:** Never trust app_preview screenshots to judge 3D quality for this project. Verify 3D via code correctness + code review. The DOM/2D parts of the editor ARE screenshot-able.

## WebGL failures must be feature-detected before mounting Canvas
R3F creates the WebGLRenderer inside an async effect, so a React error boundary does NOT catch the throw, and Vite's dev runtime-error overlay surfaces it regardless. Detect WebGL with a throwaway canvas (`getContext('webgl2'||'webgl')`) and render a flat-design fallback instead of mounting `<Canvas>`. Boundary alone is insufficient.

## Editor is auth-gated (Replit OIDC); dev preview affordance
`AuthGuard` redirects to "/" when `/api/auth/me` is 401. A dev-only bypass (`import.meta.env.DEV`) renders children without a session so the editor is viewable in development. Production stays gated.

## Avatar = procedural blocky Roblox rig (correct for the product)
Avatar is built from rounded boxes (R6/R15 style) in `assets.ts` AVATAR_BASE_MODELS; clothing "merge" = slicing the 585x559 2D design texture into UV zones (SHIRT_FRONT etc. in AvatarPreview.tsx) mapped onto box faces, live. This blocky look is intentional — custommuse also previews on the real Roblox avatar. Quality levers are lighting/materials/shadows, not de-blocking.
Default rig is now `proportioned_r15` (July 2026): user explicitly asked for a more realistic figure, superseding the earlier blocky preference. `buildAiAvatarLook` also never falls back to blocky (cyber → heroic, else proportioned_r15).

## Design texture must be generated off-DOM, not from the visible 2D canvas
The 3D avatar's clothing texture is produced by `renderDesignToCanvas` and passed to `AvatarPreview` as `previewTexture` (a dataURL). The 2D editing `<canvas ref={canvasRef}>` is only mounted in 2D/Split preview modes. **Texture generation (and PNG export) must render to a persistent off-DOM `offscreenCanvasRef`, then mirror onto the visible canvas only when mounted** — otherwise in pure 3D mode `canvasRef.current` is null, the render effect bails, and the avatar shows a stale/blank texture (the "design not visible on avatar" bug).
**Why:** preview mode unmounts the source canvas; anything keyed off `canvasRef.current` silently stops in 3D mode.
**How to apply:** never tie the texture/export pipeline to a conditionally-mounted DOM canvas. Render offscreen; treat the visible canvas as a display mirror.

## Cosmetic attachment points are hardcoded — keep head at y≈2.02
`avatar-slots.ts` BASE_POINTS hardcodes face/hair/hat/neck/etc world positions (headFront y=2.02, headTop y=2.3) independent of which rig is active. **Any change to a rig's head position in `assets.ts` will desync face decals / hair / hats** — they float off the head.
**Why:** slot anchors are global constants, not derived from the rig's actual head box.
**How to apply:** when retuning a rig, keep the head centered at y≈2.02. If you must move it, update BASE_POINTS in lockstep.

## Auth model: design free, save/export gated (kids-first)
The editor route `/editor/:id` is intentionally PUBLIC (no AuthGuard) — children create without an account.
Only **Save** and **Export PNG (Roblox-ready)** require login: those handlers short-circuit to a login Dialog when `useGetMe()` returns no user. Landing "start creating" CTAs go straight to `/editor/local`, not `/api/login`.
**Why:** product is for kids; account/payment only gates persistence + Roblox deployment.
**How to apply:** keep creation flows account-free. Dashboard/Projects/Settings stay behind AuthGuard. Frontend gating is UX only — any real save/export/deploy/payment endpoint MUST also enforce auth server-side.

## Full classic outfit from one prompt (July 2026)
One prompt now yields a whole classic outfit: shirt PNG (existing render), pants PNG
(`lib/editor/outfit.ts` — darkest palette color base + accent leg stripes + AI motif on right leg,
drawn per pants-template zones), and a 512px t-shirt motif PNG (the hero image). Upload button
downloads up to 3 files (staggered 400ms) and opens Roblox *synchronously first* (popup blockers).
Pending-payment localStorage stores JSON of all files (`parsePendingOutfit` accepts the legacy
plain data-URL); both setItem calls are quota-guarded so storage failure never blocks checkout.
**Preview gotcha:** avatar legs sample the shirt-template atlas: leg front/back zones line up with
the preview PANTS zones, but the side zone (x=44,y=288) is unpainted there — AvatarPreview uses
pantsFront for leg sides. Pants color on the avatar = four `paintLayerSet` layers on the
shirt-template leg zones added after `applyAiPlan`.
3D types (layered clothing, hair, accessories, bundles) remain impossible to auto-create/upload —
told the user; app covers Classic Shirt/Pants/T-Shirt only.

## 3D garment geometry (July 2026)
Flat textures on the blocky body never read as real clothes. AvatarPreview now has a `GarmentOverlay` (procedural hood, drawstrings, kangaroo pocket, hems/cuffs, trouser volume) driven by a `garment` prop; Create.tsx detects garment type from prompt keywords (hettegenser/hoodie, bukse/jeans, shorts). Plain clothing prompts also strip cosmetic slots (hat/neck/aura etc.) via a `wantsCosmetics` regex so the avatar stays clean like the Roblox editor.

## Universal outfit spec (July 2026)
/ai/generate now returns `result.outfit` {top,bottom,shoes,hair,accessories[],unsupported[],reason} — the AI itself parses kid-Norwegian/typos into structured items (schema in ai-contracts.ts `aiOutfitSchema`, client zod in normalize-ai-response.ts). Create.tsx maps it to GarmentOverlay geometry (hoodie/sweater/tshirt/jacket/dress, pants/shorts/skirt, sneakers/boots) + accessory/hair part kits in assets.ts, with slot-conflict handling (one hat, one back item; wings beat backpack) and an honest Norwegian item-list card (uploads vs preview-only vs unsupported). Rule: never silently substitute items; extend the enum + a part kit instead. 3D accessories are preview-only — Roblox only accepts classic clothing PNGs from the app.

## No-limits custom placement (July 2026)
outfit.customParts (max 4: shape horn/spike/orb/plate/band/snake/fin/blob × 16 attach points × size) lets kids put anything anywhere ("horn i magen"); hair.style "snakes" = Medusa kit. Enum must stay in sync in FOUR places: buildPrompt string, ai-contracts.ts zod, ai-normalize.ts allowlist (this one silently FILTERS unknown kinds — forgetting it was why unicorn_horn vanished), client normalize-ai-response.ts. 3D readability rule: never orient cones/horns straight at the camera (foreshortens to a ball) — tilt up ~0.55 rad. Verify shapes via /fit-check combos + headless WebGL screenshots.
