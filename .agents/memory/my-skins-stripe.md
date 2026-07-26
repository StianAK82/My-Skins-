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
3 free skin uploads per browser (plain httpOnly cookie `skinFreeUploads`, bypassable — MVP),
then 10 kr (1000 øre, NOK) one-time per upload via Stripe Checkout mode=payment.
No stripe-replit-sync, no webhooks, no DB: checkout is verified on return by retrieving the
session (`payment_status === "paid"`). Product/price are lazily created at runtime in
`getSkinPriceId` (search product by name, reuse/create the matching one-time price) so no
seed script is needed.
**Roblox limitation:** no real auto-upload; payment unlocks PNG download + opens Roblox
upload page. The generated skin PNG is stashed in localStorage before the Stripe redirect and
restored on the `?paid=<session_id>` return.
