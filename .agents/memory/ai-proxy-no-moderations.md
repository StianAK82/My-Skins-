---
name: AI proxy lacks /moderations
description: Replit AI Integrations OpenAI proxy does not support the moderations endpoint; use a vision chat check instead.
---

The Replit AI Integrations OpenAI proxy rejects `POST /moderations` with 400 INVALID_ENDPOINT (`omni-moderation-latest` unusable).

**Why:** discovered July 2026 when adding output moderation of generated images — the call failed at runtime despite compiling fine.

**How to apply:** for any content moderation need, do a cheap vision/text safety check via `chat.completions` (e.g. `gpt-5-mini` with image input and a strict JSON verdict) and parse fail-closed. The hero-image route + `parseImageSafetyVerdict` in the safety gateway show the pattern.
