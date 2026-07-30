---
name: Server-side clothing artifacts
description: Durable rules for the server-side Classic Clothing compile/validate/store pipeline.
---

- Native modules (`@napi-rs/canvas`, `pngjs`) must be listed in the esbuild `external` array of the api-server build script, or the build fails with "No loader for .node files". **Why:** the server bundles with esbuild; native `.node` binaries cannot be bundled.
- Export artifacts are stored as internal object-storage paths, not HTTP URLs. Anything that hands an artifact URL to an external consumer (e.g. Roblox upload) must sign it into a time-limited HTTP URL at use time. **How to apply:** canonical-artifact resolution accepts both http(s) URLs and object paths; never pass a bare object path to an external API.
- The artifact store abstraction falls back to a local-FS driver when object storage env is unset — that is what tests use; production uses the Replit GCS sidecar.
- The server compiler mirrors the client editor's template-zone geometry, and preview-only layers (accessories/hair) are excluded from exports on both sides. **Why:** preview and downloaded file must show the same pixels; keep the two zone definitions in sync if templates change.
