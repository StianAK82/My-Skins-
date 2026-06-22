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
