---
name: Headless WebGL screenshots
description: How to visually verify three.js/R3F scenes when the Screenshot tool has no WebGL
---
The built-in Screenshot tool's browser lacks WebGL, so 3D previews render the fallback message.

**How to apply:** Use playwright-core (already in node_modules, import via full pnpm store path) with a Nix chromium, e.g. `/nix/store/43y6k6fj85l4kcd1yan43hpdld6nmjmp-ungoogled-chromium-131.0.6778.204/bin/chromium`, launched with `--no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader --in-process-gpu`. Screenshot `http://127.0.0.1:80/<path>`, wait ~9s for software GL to render, view PNGs with ReadFile.

**Gotchas:**
- drei `SoftShadows` patches shaders globally — multiple simultaneous canvases break ("randRGB already has a body"); render ONE canvas per page (my-skins has hidden `/fit-check?combo=N` QA route, 24 combos).
- drei `RoundedBox` radius must be < half the smallest dimension or geometry folds into spikes (AvatarPreview now clamps this).
- Animated (IdleGroup-rotated) drei RoundedBox meshes get wrongly frustum-culled — arms vanished during the dance until `frustumCulled={false}` was set on BodyPart RoundedBoxes. Diagnose by capturing several timed frames of the animated canvas.
