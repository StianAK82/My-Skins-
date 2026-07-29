---
name: my-skins Roblox OAuth direct upload
description: "Logg inn med Roblox" OAuth flow + direct classic-clothing upload; constraints and known risks
---

# Roblox OAuth direct upload (July 2026)

- Backend: `artifacts/api-server/src/routes/roblox-oauth.ts` — OAuth2 PKCE against apis.roblox.com, scopes `openid profile asset:read asset:write`. Session = HMAC-signed (SESSION_SECRET) httpOnly cookie with access/refresh tokens; refresh-on-demand. Secrets: ROBLOX_CLIENT_ID / ROBLOX_CLIENT_SECRET (user registered the app themselves in Creator Dashboard; redirect URL is the dev domain + `/api/auth/roblox/callback` — must add the production URL there before publishing).
- **Upload uses a LEGACY, unsupported endpoint**: `itemconfiguration.roblox.com/v1/avatar-assets/{11|12|2}/upload` (Shirt/Pants/TShirt). Open Cloud Assets API does NOT support classic clothing. May reject OAuth Bearer tokens (cookie-auth era API) — untested against a real logged-in account; the frontend always falls back to the manual download flow on failure.
- **Roblox March 2026 rules**: every 2D upload costs the CUSTOMER 10 Robux; upload via API requires ID-verified Roblox account; *selling* on Marketplace additionally requires Roblox Premium. User has been told all this.
- Failure-path invariant (from code review): a paid credit must never strand the user — `readyFiles` state + "Last ned filene på nytt" button allows free retry; PENDING_SKIN_KEY in localStorage only cleared after fully successful direct upload.

**3D route (July 2026):** Roblox has NO API for uploading 3D/layered clothing — Marketplace 3D publishing requires Studio + ID-verified account + Plus/Premium + 80 Robux fee + publishing advance (account-level, can't be done on the child's behalf). User accepted the compromise: app now offers a free "Last ned som 3D-fil" button (GLB export of the live preview via GLTFExporter) + a Norwegian parent guide modal explaining the Studio path. 2D classic clothing remains the only automatic upload.
