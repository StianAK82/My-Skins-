# Internal promotion codes report

## 1. Final status

Implemented for internal testing. Stripe, Roblox, Marketplace, and production 3D remain out of scope and disabled.

## 2–5. Gaps, migration, campaign, and redemption models

Legacy promotion tables store raw checkout-discount codes and do not grant ledger credits. Migration `0007` adds hashed, versioned internal campaigns, bounded counters, eligibility, mode, JSON grant definitions, expiry, audit metadata, and idempotent redemptions linked to ledger transaction IDs. The legacy disposition is documented in `docs/implementation/promotion-code-migration.md`.

## 6–12. Security and atomic flow

Codes are trimmed, NFKC-normalized, uppercased, strictly ASCII validated, length bounded, and HMAC-SHA-256 hashed with `PROMOTION_CODE_PEPPER`. Redemption requires authentication and rate limiting, then uses serializable isolation and a campaign row lock. It validates windows, campaign/user limits, user/domain eligibility, selected mode, and configuration before appending every grant and the redemption atomically. Customer errors are generic; audit logs contain IDs and diagnostic codes, never raw codes. Campaign expiry and grant expiry are separate. `EITHER` bundles resolve all `SELECTED` entries to one stored mode.

## 13–16. Administration, API, UI, and migration

Allowlisted server admins can create, activate, disable, inspect metrics, and reverse campaigns/redemptions. Reversal appends `CHARGEBACK_REVERSAL` ledger entries. Customer APIs are `POST /api/promotions/redeem` and `GET /api/promotions/redemptions/recent`. Create exposes child-friendly code redemption and refreshes the authoritative entitlement summary. `INTERNAL_PROMOTIONS_ENABLED` is validated at startup together with pepper and admin configuration.

## 17–19. Tests

Unit tests cover normalization, Unicode handling, hashing, selectable bundles, generic errors, and admin authorization; 229 repository unit tests pass across API and UI. Migration/accounting tests cover append-only ledger behavior, and 23 repository integration tests pass. Browser fixtures cover successful redemption and balance refresh without Stripe or live providers; eight tests are discovered, but the seven deterministic browser cases cannot launch locally because Chromium is unavailable. Exact command outcomes are reported in the final response.

## 20. Remaining limitations

Database concurrency and final-slot tests require the PostgreSQL CI/staging harness. The in-process limiter complements campaign/user database constraints but production distributed abuse protection should also use the edge gateway. Chromium evidence depends on CI because the local browser binary is unavailable.

## 21. Commit

Recorded in Git history; embedding a commit's own hash would change that hash.

## 22. Exact next milestone

**STRIPE WEBHOOK-BASED CREDIT PURCHASES USING THE AUTHORITATIVE ENTITLEMENT LEDGER**
