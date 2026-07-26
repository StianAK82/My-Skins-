---
name: my-skins Stripe per-upload payment
description: Per-upload one-time Stripe payment flow and the Replit Stripe connector credential shape.
---

## Replit Stripe connector settings key names
The connection API (`/api/v2/connection?connector_names=stripe`) returns `settings` with keys
`{ account_id, secret, publishable, mcp, claim_url }` — NOT the `secret_key`/`webhook_secret`
the generic Stripe skill template assumes. Read `settings.secret` for the API key.
**Why:** the skill's `stripeClient.ts` template checks `settings.secret_key` and throws
"missing secret key" against this connector. **How to apply:** in `stripeClient.ts` use
`settings.secret ?? settings.secret_key`. No webhook_secret is provided.

## Payment model (July 2026)
NO free uploads (user decision July 2026: must pay before any Roblox upload; FREE_LIMIT=0).
10 kr (1000 øre, NOK) buys a pack of 3 upload credits via Stripe Checkout mode=payment.
Credits tracked in httpOnly cookie (bypassable — accepted MVP tradeoff).
No stripe-replit-sync, no webhooks, no DB: checkout verified on return by retrieving the
session. Anti-replay: checkout sets a pending-session cookie that must match on verify, and
granted session ids are tracked in a cookie list so old paid sessions can't re-grant credits.
Price resolution: prefer the price behind the user's live Payment Link
(https://buy.stripe.com/7sY6oK5HQ8mj3nAg8l7ss02 — only visible with live keys); in test mode
falls back to lazily creating a 10 NOK product/price. No seed script.
**Roblox limitation:** no real auto-upload; payment unlocks PNG download + opens Roblox
upload page. The generated skin PNG is stashed in localStorage before the Stripe redirect and
restored on the `?paid=<session_id>` return.
