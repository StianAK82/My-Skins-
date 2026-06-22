---
name: My Skins 3D editor preview & rendering
description: How the Roblox clothing 3D preview works, its WebGL/screenshot constraint, and the dev auth affordance.
---

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
Default rig is `classic_blocky` (the iconic R6 silhouette) — users read R15/proportioned as "not Roblox", so prefer the blocky rig as the face of the product.

## Cosmetic attachment points are hardcoded — keep head at y≈2.02
`avatar-slots.ts` BASE_POINTS hardcodes face/hair/hat/neck/etc world positions (headFront y=2.02, headTop y=2.3) independent of which rig is active. **Any change to a rig's head position in `assets.ts` will desync face decals / hair / hats** — they float off the head.
**Why:** slot anchors are global constants, not derived from the rig's actual head box.
**How to apply:** when retuning a rig, keep the head centered at y≈2.02. If you must move it, update BASE_POINTS in lockstep.

## Auth model: design free, save/export gated (kids-first)
The editor route `/editor/:id` is intentionally PUBLIC (no AuthGuard) — children create without an account.
Only **Save** and **Export PNG (Roblox-ready)** require login: those handlers short-circuit to a login Dialog when `useGetMe()` returns no user. Landing "start creating" CTAs go straight to `/editor/local`, not `/api/login`.
**Why:** product is for kids; account/payment only gates persistence + Roblox deployment.
**How to apply:** keep creation flows account-free. Dashboard/Projects/Settings stay behind AuthGuard. Frontend gating is UX only — any real save/export/deploy/payment endpoint MUST also enforce auth server-side.
