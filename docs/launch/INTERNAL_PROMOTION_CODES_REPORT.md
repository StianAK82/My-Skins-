# Internal promotion codes report

## 1. Final status

Implemented for internal testing. Stripe, Roblox, Marketplace, and production 3D remain out of scope and disabled.

## 2. Existing promo gaps found

Legacy tables store raw checkout-discount codes, are not ledger grants, and lack atomic idempotency. They remain isolated and unmounted.

## 3. Database migration

Migration `0007` adds versioned hashed campaigns and redemptions with database checks, unique hash/idempotency constraints, ledger-ID linkage, and indexes.

## 4. Campaign model

Campaigns contain configuration version, hash/mask, safe descriptions, windows, counters/limits, allowed mode/users/domains, grant definitions, credit lifetime, creator, disable time, and bounded metadata.

## 5. Redemption model

Redemptions persist campaign, user, idempotency key, selected mode, status, request correlation, time, and every ledger transaction ID.

## 6. Normalization and hashing

Codes are trimmed, NFKC-normalized, uppercased, strictly ASCII validated, length bounded, and HMAC-SHA-256 hashed with `PROMOTION_CODE_PEPPER`. Raw codes are never logged or persisted by the server.

## 7. Atomic redemption flow

After authentication/rate limiting, redemption uses serializable isolation and locks the campaign. It validates limits, windows, eligibility, mode, and grants before inserting all ledger rows, redemption, and projection update in one commit.

## 8. Ledger grants

Every award is a `PROMOTION` row in `entitlement_transactions`; neither user/profile credit columns nor a second balance system are used.

## 9. 2D/3D selectable grants

Grant entries name a real ledger `creditType` and optional asset-mode restriction. `EITHER` campaigns require one stored selection and consistently map matching generation/export/delivery entries to that mode.

## 10. Expiry handling

Campaign expiry controls redemption. Absolute or lifetime-based credit expiry is written to each ledger row, and the existing balance derivation excludes expired grants without deleting them.

## 11. Limits and concurrency

The locked campaign projection enforces total limits; per-user counts and unique idempotency are checked under the same lock. Replays return the original ledger grants and cannot switch hash or mode.

## 12. Rate limiting

The authenticated route limits user/IP attempts and emits generic customer errors. Production should additionally enforce distributed edge limits.

## 13. Admin tooling

Explicitly allowlisted server admins can create/activate/disable campaigns, inspect safe metrics, grant support credits, and append reversals. Startup validates the pepper and allowlist when promotions are enabled.

## 14. API changes

Customer APIs are `POST /api/promotions/redeem` and `GET /api/promotions/redemptions/recent`; internal administration routes require server-side authorization.

## 15. UI changes

Create exposes child-friendly code redemption, uses a durable hashed-code request key for refresh-safe retries, sends the selected preview mode, and refreshes authoritative entitlements after success.

## 16. Legacy migration

The full isolate/deprecate/removal decisions are in `docs/implementation/promotion-code-migration.md`; there is only one mounted customer redemption system.

## 17. Unit-test results

Core tests cover normalization/Unicode, hashing, grant validation, selectable modes, expiry, campaign windows/limits, generic errors, and admin authorization. The repository unit command passes 237 tests (174 API and 63 UI).

## 18. Integration-test results

Repository integration now passes 28 tests, including transaction/migration contract checks for serializable locking, insertion order, unique replay, versioned hashed storage, and append-only reversal. A live PostgreSQL concurrency harness remains required for production verification.

## 19. Browser-test results

Deterministic fixtures cover successful redemption and authoritative balance refresh without Stripe or live AI. Chromium remains unavailable locally; CI is configured to install it.

## 20. Remaining limitations

Apply migration `0007` and run concurrent/final-slot/restart scenarios against staging PostgreSQL. Add distributed gateway throttling and operational alerts before production exposure.

## 21. Commit hash

Recorded in Git history; embedding a commit's own hash would change that hash.

## 22. Exact next milestone

**STRIPE WEBHOOK-BASED CREDIT PURCHASES USING THE AUTHORITATIVE ENTITLEMENT LEDGER**
