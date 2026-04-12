# CustomUse Parity Implementation Plan for My Skins

Date: 2026-04-12
Scope: `artifacts/my-skins`, `artifacts/api-server`, `lib/db`

## Executive summary

To reach practical parity with CustomUse's Roblox clothes maker, My Skins should be implemented as a **template-first, layer-based 2D texture editor** with a synchronized **live 3D avatar preview**, plus a reusable asset system (uploads, media, accessories, AI media), deterministic export, and integration-ready seams for Roblox upload + billing entitlements.

This plan intentionally excludes a free-form color picker and logo design tooling. It focuses on swatch-driven recolor, mask-safe placement, and production-grade reliability.

## Product parity requirements

### 1) Core editor shell
- Left tool rail: Templates, Uploads, Media, AI Media, Accessories, Text, Draw.
- Center stage: 2D canvas and 3D avatar preview toggle.
- Right panel: layer stack and contextual properties.
- Single canonical editor state shared by 2D, 3D, and export.

### 2) Templates and zones
- Support classic Roblox shirt and pants templates.
- Add optional “suit” flow that exports shirt + pants together.
- Define a template zone map JSON for safe placement and guided transforms.
- Enforce an editable mask to block invalid paint/overlay areas.

### 3) Layer model
Implement a typed layer stack with:
- `basePaintLayerSet` (paint1..paintN + mask + optional non-paint)
- `imageLayer` (uploads/media/AI media)
- `textLayer`
- `brushLayer`
- `accessoryLayer`

Required controls:
- select, duplicate, reorder, opacity, visibility/lock
- transform (move/resize/rotate)
- per-layer settings in inspector

### 4) Recolor + paint-layer compositor
- Swatch-based recolor pipeline (no free-form color picker UI).
- Paint layers multiplied by chosen swatches, then composited.
- Optional non-paint rendered above recolored surfaces.
- Overlay layers clipped by mask and zone rules.

### 5) Draw tool
- Brush presets + eraser.
- Adjustable size/opacity/softness/spacing.
- Multiple brush layers.
- Pattern/stamp brush extensibility (restricted preset set for classic clothing mode).

### 6) Text tool
- Text layer creation and transform controls.
- Font selection from curated set.
- Outline, alignment, bold/italic/underline controls.

### 7) Asset libraries
- Uploads manager with duplicate and z-order actions.
- Media library for curated assets.
- Accessories library with categories and swatch-based recolor.
- AI media generation that inserts generated PNGs as standard image layers.

### 8) 3D preview parity
- Real-time preview updates from canonical texture snapshot.
- Orbit/zoom controls.
- Body-type switch at minimum: Blocky, Boy, Girl.
- Performance defaults:
  - demand-driven render loop
  - model/material reuse
  - minimal object churn on updates

### 9) Export pipeline
- Deterministic export from canonical editor state.
- Classic mode: PNG export (optionally JPG), template-aligned output.
- Suit export creates two files (shirt + pants).
- Generate and store thumbnails alongside canonical export artifacts.

### 10) Integration-ready seams
- Roblox upload seam (future enablement): OAuth connection entity + upload jobs + worker status model.
- Billing seam: promo-code and entitlement resolver integrated into feature gating.

## Suggested architecture

## Frontend
- `EditorShell`
  - `ToolSidebar`
  - `CenterStage` (`Canvas2D`, `Preview3D`, toggle)
  - `RightPanel` (`LayersList`, `Inspector`)
- Centralized editor store powering renderers + serializer.
- Worker-backed compositing for heavy recomposition/encoding paths.

## Backend
- API server for save/load/export + AI orchestration.
- Object storage/CDN for templates, assets, exports, thumbnails.
- Queue + workers for AI, background removal, HD processing, and upload jobs.
- Observability: structured logs + metrics for export latency/failure, AI schema failures, upload status.

## Data model additions (high-level)

- `garment_templates`
- `designs` (with canonical state + export artifact refs)
- `user_assets`
- `accessory_assets`
- `pattern_assets`
- `roblox_connections`
- `roblox_upload_jobs`
- `promo_code_redemptions` + entitlement effects linkage

## Testing strategy

### Unit
- zone/mask invariants
- compositor correctness (golden image diffs)
- text/outline rendering fallback behavior

### Integration
- save → reload → export determinism checks
- asset ingest + thumbnail generation validation
- AI endpoint schema validation and rate-limit behavior

### E2E
- template selection → design edits → export
- accessory add + recolor + export
- 2D/3D toggle consistency
- body-type switch texture consistency

## Delivery roadmap

1. **Spec lock and UX wireframes**
2. **Core parity** (templates + layers + tools + classic export)
3. **Accessories + recolor compositor**
4. **3D parity** (real-time preview + body switches + perf)
5. **AI parity** (classic texture and AI media flows)
6. **Hardening** (tests, queue, caching, observability)
7. **Integration enablement** (Roblox upload + promo hooks)

## Controlled beta exit checklist

- Core tool loop complete (Templates, Uploads, Media, Text, Draw, Accessories, AI media).
- Deterministic canonical export and thumbnail generation.
- 3D preview with rotate/zoom and body-type switching.
- Queue-backed heavy processing and basic abuse protection.
- End-to-end test coverage for top user journeys.
- Upload security checks and content validation.
- Integration seams implemented and feature-flagged for staged rollout.
