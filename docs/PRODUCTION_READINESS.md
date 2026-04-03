# My Skins Production Readiness Map

## Fully working now
- Structured AI routes with strict Zod contracts and 422 schema failure behavior:
  - `POST /api/ai/generate`
  - `POST /api/ai/generate-idea`
  - `POST /api/ai/improve`
  - `POST /api/ai/remix`
  - `POST /api/ai/generate-modules`
  - `POST /api/ai/generate-palette`
  - `POST /api/ai/generate-layout`
- Backward-compatible AI adapters for existing editor endpoints:
  - `POST /api/ai/generate-outfit`
  - `POST /api/ai/remix-outfit`
- Frontend AI panel hardened for strict structured responses, failure UI, retry/refine/remix flows, and explicit apply actions.
- AI schema test coverage for valid payload, invalid placement, and itemType placement logic.

## Prepared and activation-ready (credential dependent)
- Roblox auth/service routes and data tables remain in place for OAuth activation.
- Stripe payment architecture and routes remain ready for credential enablement.
- Export and editor persistence pipelines remain active for classic shirt/pants.

## Environment variables
- `OPENAI_API_KEY`: Required for all structured AI generation routes.
- `DATABASE_URL`: Required for generation history persistence and app data.
- `SESSION_SECRET`: Required for session integrity.
- `STRIPE_SECRET_KEY`: Required to activate Stripe payment processing.
- `STRIPE_WEBHOOK_SECRET`: Required to validate Stripe webhooks.
- `ROBLOX_CLIENT_ID`: Required to activate Roblox OAuth login.
- `ROBLOX_CLIENT_SECRET`: Required to activate Roblox OAuth token exchange.
- `ROBLOX_REDIRECT_URI`: Required Roblox OAuth callback URL.

## Notes
- The AI server now rejects malformed model JSON with HTTP 422 and never silently falls back.
- Placement is enforced by item type (`classic_shirt` vs `classic_pants`) at schema-validation stage.
