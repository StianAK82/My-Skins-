# Free-first generation ledger report

## 1. Final status

**IMPLEMENTED FOR INTERNAL TESTING; not overall launch-ready.** This milestone adds the durable ledger and protects the active generation flow. Stripe, customer promotion redemption, Roblox OAuth/delivery, Marketplace, production 3D, and the remaining launch blockers are deliberately outside scope and server-disabled by default.

## 2. Audited generation entry points / protection map

| Route | Caller | Expensive call | Auth | Entitlement | Action |
|---|---|---:|---:|---:|---|
| `POST /api/ai/generate` | `Create.tsx` | text model/concept/repair | yes | reserve first | canonical new generation |
| `POST /api/ai/hero-image` | `Create.tsx` materialization | image + moderation model | yes | active generation required | included in original reservation |
| `POST /api/ai/visual-review` | five-view Create effect | vision model | yes | active generation required | capture only READY; release terminal/unavailable |
| improve/remix/idea/modules/palette/layout/stylized | legacy clients | text model | formerly inconsistent | no safe binding | provider handlers isolated with 410; redesign uses canonical start |
| generate-outfit/remix-outfit | mounted legacy router | none (already 410) | yes | not applicable | remain deprecated |
| history | Create/diagnostics | none | yes | no | read-only |

Trace: Create creates server-safe correlation identifiers → `/api/ai/generate` validates/authenticates → serializable reservation → `AiGenerationService` → model provider → protected hero images → external visual review → READY capture or release.

## 3–8. Identity, migration, ledger, balance, modes, free grant

The identity is immutable internal `users.id`, never a browser or Roblox identity. Migration `0006` creates account, typed append-only transaction, and reservation tables; enum values cover generation, export, delivery, purchase, promotion, administration, refund, expiry, chargeback and support. A database trigger rejects ledger updates/deletes. Unique indexes enforce grant, idempotency, generation and finalization identity.

Available balance is derived from posted, unexpired grants minus captures, active reservations, expiry and reversal effects. RELEASE is audit activity rather than a second grant. The one free unit is fungible between a selected 2D or 3D preview but the reservation/capture retains the selected typed mode. Separate export and delivery credit types exist but are not consumed.

Free initialization is idempotent (`ON CONFLICT` plus a locked account row and partial unique free-grant index). Refresh, relogin, Roblox reconnect and profile edits cannot mint a grant.

## 9–14. Reservation, capture, release, recovery, idempotency, concurrency

Generation validates safe 8–200 character correlation keys. Under `SERIALIZABLE`, the account row is locked, replay is checked, authoritative availability is calculated, and both reservation ledger event and durable reservation are inserted before providers. The policy is server-versioned as `free-first-v1` with cost one in either preview mode.

Only external-review categorical `READY` appends CAPTURE. Unsupported results, provider/schema failures and external-review unavailability release. Terminal review states release; nonterminal repairs keep and reuse the reservation. Finalization locks the reservation and is idempotent, so duplicate capture/release cannot cross-finalize. Reservations expire after 15 minutes; `reconcileAbandonedReservations` releases expired active records with a safe reason. Deployment must schedule this method from its task runner (known limitation below).

Unique keys plus row locking prevent concurrent free grants, request replay, double reservation and duplicate finalization. A repeated active request returns `GENERATION_IN_PROGRESS` without a provider call.

## 15. Protected routes and providers

All mounted standalone text-generation routes that lacked a logical reservation are 410-isolated. Hero image and moderation calls require ownership of an active reservation. Visual review also requires it. Safety middleware remains before routes; authentication and validation occur before reservation/provider work.

## 16–18. Legacy migration, API and UI

The complete old-source disposition is in `docs/implementation/generation-entitlement-migration.md`. `GET /api/entitlements/generation-summary` exposes only child-safe availability, reservation count, permissions, and normalized activity—never IDs/payment metadata. Create offers 2D/3D selection, disables generation from server state, refreshes it after attempts, and uses the required child-friendly wording. Server checks remain authoritative.

Server feature flags default Stripe purchase, Roblox OAuth, Roblox delivery, Marketplace and production 3D export to off. Secure/test administration can append bounded grants; promotion-shaped transactions, expiry and audit metadata are supported, but there is no customer redemption.

## 19–21. Test results

Implementation run: frozen install, typecheck, unit (219 passing across API and UI), repository integration (23 passing), combined test, package build, application build, Playwright discovery (7 tests) and diff checks passed. Playwright execution could not start its five deterministic Chromium tests because the managed Chromium executable was absent; installation was attempted and all configured CDN mirrors returned HTTP 403. The real-provider staging case was correctly skipped by configuration. CI installs Chromium with dependencies and executes the same suite. Normal PR tests do not invoke live AI.

## 22. Known limitations

* The reconciler method is implemented but must be connected to the deployment scheduler/startup task.
* A replay while work is active is provider-safe and returns in-progress; durable replay of the complete prior HTTP payload after process loss still needs a generation-response projection.
* Database-backed concurrency/integration coverage requires the deployment PostgreSQL harness; repository integration tests in this environment do not apply migration `0006` against a live PostgreSQL instance.
* Local screenshot evidence could not be refreshed because Chromium was unavailable and browser downloads were denied with HTTP 403; CI is configured to install and run Chromium.
* The current visual pipeline normally categorizes structural output as `NEEDS_REPAIR`; therefore free credits release unless real external review reaches READY.
* This does not close unrelated P0/P1 launch blockers and does not make the product launch-ready.

## 23. Commit

Recorded by Git history for this report's commit (the report cannot embed its own final hash without creating a different hash).

## 24. Exact next milestone

**INTERNAL PROMOTION CODES USING THE AUTHORITATIVE ENTITLEMENT LEDGER**
