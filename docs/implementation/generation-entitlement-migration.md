# Generation entitlement migration

## Identity and eligibility

The only eligible identity is an authenticated internal `users.id`. Account initialization inserts an `entitlement_accounts` row and one `FREE_FIRST_SKIN` transaction with database uniqueness. Browser storage, cookies, IP addresses, Roblox identity, profile edits, refresh, and login cycles never establish eligibility. The free grant is a single fungible **preview** grant: its ledger row is represented as `GENERATION_2D`, while reservation records the customer's chosen `GENERATION_2D` or `GENERATION_3D`; summary availability for both modes is backed by the same remaining unit. It does not grant export or delivery.

## Old-source disposition

| Old source | Active caller | Classification | Authoritative replacement | Compatibility period | Removal condition | Risk |
|---|---|---|---|---|---|---|
| payment/browser cookies | payment routes and old delivery UI | isolate/deprecate | `entitlement_transactions` for generation only | retained for unrelated legacy download behavior | signed-webhook billing milestone migrates it | client-controlled state must never enter generation queries |
| `users.credits` | legacy billing/admin code | isolate | append-only ledger | read compatibility outside generation | all consumers migrated | ambiguous units |
| `user_profiles.aiCredits` | no active canonical generation caller | deprecate | append-only ledger | none for generation | schema cleanup migration | stale balance |
| `credit_transactions` | legacy payment/upload allowance | retain for unrelated legacy behavior, remove later | typed ledger for future migration | through Stripe milestone | webhook ledger cutover reconciled | purchase/session semantics are incomplete |
| upload allowance/free counters | Create delivery/download flow | isolate | no replacement in this milestone; generation summary endpoint is separate | until 2D delivery entitlement milestone | delivery ledger is active | upload is not generation |
| generic `entitlements` | billing-state display | retain for subscription compatibility | typed ledger | until catalog migration | no active callers | generic keys cannot safely account credits |

Generation routes are forbidden from consulting any old source. No historical numeric balance is automatically migrated because its meaning cannot be proven; secure administrative grants can append explicitly reviewed credits.

## Revision policy

Localized image materialization and visual-review retries reuse the active logical generation and reservation. A complete redesign and the current structured `previousOutfit` customer revision start a new logical generation and require a new credit. A visual correction can try twice; terminal `NEEDS_REPAIR`, `MANUAL_REVIEW`, safety/unsupported/schema/provider failures, and unavailable external verification release the reservation. Only categorical `READY` captures.

