# Promotion code migration

| Existing source                                   | Decision                                  | Reason / removal condition                                                                                                            |
| ------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `promo_codes` discount rows                       | Isolate and deprecate                     | Stores raw codes and checkout discounts. It is not mounted as a customer redemption API. Remove after Stripe catalog migration.       |
| `promo_code_redemptions`                          | Isolate and deprecate                     | Records mutable-price discounts rather than ledger grants and lacks idempotency. Remove with the legacy discount subsystem.           |
| `validatePromoCode` upload/subscription validator | Retain only for legacy tests, never mount | The internal redemption route exclusively uses `InternalPromotionService`. Remove when Stripe promotions receive their own milestone. |
| upload-credit promotion target                    | Isolate                                   | Upload allowances are not generation/export/delivery ledger credits.                                                                  |
| beta-invite target                                | Retain for unrelated invitation behavior  | It cannot grant credits and must not call the internal promotion API.                                                                 |

Internal campaigns store only an HMAC-SHA-256 hash of the normalized code. Redemptions lock the campaign under serializable isolation and append `PROMOTION` entries to `entitlement_transactions`; no balance column is updated. Raw codes are accepted only in the request body and are never logged or persisted.
