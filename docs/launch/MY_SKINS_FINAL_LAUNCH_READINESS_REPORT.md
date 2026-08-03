# My Skins final launch-readiness report

**Audit date:** 2026-08-03 UTC  
**Audited checkout:** branch `work`, commit `34af861c83babd29bda545a5b80e995864ab92f0`  
**Requested continuation:** `cc26cb0836c17cd610135124e84d8eba5d14ce33` is not an object in this checkout (`git cat-file -e`/revision-range resolution fails), so ancestry from that identifier cannot be established.  
**Evidence standard:** repository source and commands executed in this checkout only. No prior audit or implementation document was accepted as proof. No real Stripe, Roblox, staging-provider, moderation, Studio, Creator Hub, or human visual evidence was available to this audit.

## 1. Executive summary

**Overall recommendation: `INTERNAL_TEST_ONLY`.** The application is not ready for closed beta involving children, payment, Roblox linking, or delivery. It contains substantial deterministic AI, renderer, Classic PNG, persistence, OAuth, and upload architecture, but the active customer flow has no generation entitlement gate; “free first skin” does not exist; payment credits live in client-controlled browser cookies and are granted by a success-page verification route rather than a signed webhook; exports are not charged; two competing Roblox integrations have materially different security and persistence properties; no provider/Stripe/Roblox external result is verified; and 3D is preview/export geometry rather than Roblox production geometry.

The deterministic suites pass (153 API tests, 63 web tests, 23 integration tests), typecheck and builds pass. The browser suite could not execute because its managed Chromium binary is absent locally; the staging provider test is intentionally skipped in normal execution. Passing fixtures demonstrate architecture, not launch quality.

### Product-model verdicts

| Question | Factual answer |
|---|---|
| AI ready? | **No.** `IMPLEMENTED_NOT_REAL_TESTED`; real provider and human acceptance are unverified. |
| Five-view acceptance verified? | **No.** Architecture/test fixtures exist; local browser execution failed and no current human approval exists. |
| One free first skin? | **No.** Generation is presently ungated and the upload allowance is explicitly zero. |
| Stop generation at zero credits? | **No.** `/api/ai/generate` calls generation without an entitlement reservation. |
| Internal promo credits? | **No.** Discount validation/schema exists only for a narrow upload-credit discount; no redemption route or grant ledger flow exists. |
| Stripe promotion codes? | **No.** Checkout does not set `allow_promotion_codes`. |
| Stripe live verified? | **No.** |
| 2D export ready? | **`VERIFIED_BETA_READY` / `BETA_READY` for authenticated deterministic Classic artifact generation only**, not paid launch or Roblox acceptance. |
| Real 2D delivery ready? | **No.** `PARTIAL`, with an explicitly unreliable legacy endpoint and no real evidence. |
| 3D Roblox ready? | **No.** `PLACEHOLDER`; output is preview/download geometry. |
| Roblox OAuth real tested? | **No.** Two implementations exist; neither has real evidence, and one stores bearer/refresh tokens in a signed but unencrypted cookie. |
| Marketplace sale implemented? | **No.** `MISSING`. |

## 2. Current commit and repository state

| Baseline item | Direct result |
|---|---|
| Branch / commit | `work` / `34af861c83babd29bda545a5b80e995864ab92f0` |
| Requested commit | Not present in local object database; audit cannot claim it continued from that commit. |
| Initial worktree | Clean before the audit report and generated Playwright output; generated output was removed. |
| Node / package manager | Node `v24.15.0`; pnpm `10.28.1`; root pins `pnpm@10.28.1`. |
| Workspaces | `artifacts/*`, `lib/*`, `lib/integrations/*`, `scripts`; 12 projects including root. |
| Production entry points | API `artifacts/api-server/src/index.ts` → compiled `dist/index.mjs`; web Vite entry `artifacts/my-skins/src/main.tsx`; `.replit` declares application autoscale routing but does not state runnable process commands. |
| Active deployment config | `.replit` only; autoscale, post-build `pnpm store prune`. No Docker/Kubernetes/Vercel/Fly/Render definition found. |
| GitHub Actions | `my-skins-visual.yml` on PR/manual; `my-skins-staging-provider.yml` manual only. No general deploy, migration, security, payment, or production-smoke workflow. |
| Root commands | `typecheck`, `test:unit`, `test:integration`, `test`, `build:packages`, `build`, `test:visual`. No lint command. |

### Workspace/entry-point risks and legacy duplication

* `artifacts/mockup-sandbox` is an active workspace/build despite being a mockup.
* `routes/ai.ts` legacy endpoints and `routes/ai-v2.ts` canonical endpoints are both mounted. Safety middleware covers `/ai/*`, but legacy paths remain callable.
* Roblox is duplicated: DB-backed `/api/roblox/*` and cookie-backed `/api/auth/roblox/*`. The Create page uses the latter for connection/upload, bypassing the stronger DB job pipeline.
* Payments are an isolated cookie subsystem (`routes/payments.ts`) while DB billing/entitlement schemas and Stripe lifecycle helpers are not connected to that customer flow.
* Documentation describes stronger systems than the active frontend/payment path proves.

## 3. Overall launch recommendation

| Launch target | Decision | Reason |
|---|---|---|
| Closed beta | **NO** under current scope; remain `INTERNAL_TEST_ONLY` | Unlimited ungated generation, child/parent gaps, no executable browser evidence, and unsafe payment/OAuth paths. A non-child, no-payment, no-Roblox internal design lab can be tested. |
| Paid public launch | **NO_GO** | Stripe fulfillment, ledger, refunds/disputes, tax/catalog consistency, and external verification are absent. |
| Real Roblox connection | **NO_GO** | Implemented but not real-tested; duplicate paths, unencrypted tokens, missing revoke/nonce/parent controls. |
| Validated 2D delivery | **NO_GO** | Local Classic validation is credible; Roblox delivery itself is not provider-validated. |
| Real 3D delivery | **NO_GO** | No Roblox rig/cages/skin weights/Studio validation/submission. |
| Marketplace publication/sale | **NO_GO** | No eligibility, moderation polling, listing, price, publication, or sale workflow. |

## 4. Readiness by subsystem

Each capability below has exactly one required classification.

| Capability | Classification | Frontend caller → backend | DB / tests / external config | Remaining risk / severity |
|---|---|---|---|---|
| AI generation | `IMPLEMENTED_NOT_REAL_TESTED` | `Create.generate` → `POST /api/ai/generate` → `aiGenerationService.generateDesign`; hero textures use `/ai/hero-image` | `ai_generations`; extensive deterministic unit/golden tests; OpenAI integration keys required but not startup-validated | Provider cost/failure/quality and timeout behavior unverified; **P0 beta** |
| Visual quality | `IMPLEMENTED_NOT_REAL_TESTED` | `Create` captures AvatarPreview views → `/ai/visual-review` | No durable review/evidence manifest DB linkage; fixture Playwright and manual staging workflow only | No current runnable/human/provider evidence; repairs not applied from reviewer; **P0 beta** |
| First free skin | `MISSING` | Generation calls no payment endpoint; payment UI calls `/payments/skin-status`/`consume-free` for upload/download flow | Cookie-only counters; no tests; `FREE_LIMIT=0` | Product promise false; unlimited generation and no durable grant; **P0** |
| Credit system | `UNSAFE` | Upload/download control → `/payments/consume-free`; generation bypasses it | DB has `credits`, `aiCredits`, thin `credit_transactions`, but active payment path uses cookies; no concurrency tests | Cookie rollback/replay, no atomic reserve/capture/release; **P0 paid** |
| Promo codes | `PARTIAL` | No frontend caller or API redemption route | `promo_codes`, `promo_code_redemptions`, pure validator tests only | No atomic redemption/grant/admin flow/brute-force control; **P1** |
| Stripe payments | `UNSAFE` | Create pricing action → create Checkout → success query → `/payments/verify` | No webhook persistence/dedupe/ledger; Replit connector secret; no Stripe tests or live config evidence | Fulfillment from redirect, cookie dedupe, no refunds/disputes/reconciliation; **P0 paid** |
| 2D Classic export | `VERIFIED_BETA_READY` | Project/export UI → `POST /api/exports`; compiler/validator/storage/download route | Export/artifact tables; deterministic/integration tests; `DATABASE_URL`, private object directory | Not real Roblox-moderated; automatic rights/moderation “approved”; no entitlement charge; **P1 paid** |
| 2D Roblox delivery | `PARTIAL` | Active Create uses `/auth/roblox/upload`; alternative project flow `/roblox/upload` | Cookie path has no DB/job/idempotency; DB path has job/event tests; Roblox credentials/endpoints | Legacy endpoint explicitly may reject OAuth tokens; no real upload evidence; **P0 delivery** |
| 3D preview | `VERIFIED_BETA_READY` | `AvatarPreview`, procedural Three meshes, client GLB exporter | Renderer unit tests; no server artifact validation | Suitable only if prominently labeled preview; browser screenshots unavailable here; **P1 truthfulness** |
| 3D Roblox production | `PLACEHOLDER` | Client GLB download only; no production route | No Roblox 3D artifact/job schema semantics or validation tests | Missing rig/cages/weights/topology/Studio/API validation; **P0 3D** |
| Roblox OAuth | `UNSAFE` | Create uses `/auth/roblox/*`; alternative `/roblox/*` project routes | Cookie path none; DB path connection/state tables; deterministic helpers only; Roblox dashboard config needed | No real test; cookie tokens unencrypted; duplicate callbacks; no revocation; **P0 connection** |
| Marketplace publication | `MISSING` | No caller/route | No listing/moderation/sale tables or tests/config | Upload is not publication or sale; **P0 marketplace** |
| Child/parent safety | `PARTIAL` | Friendly UI and safety gateway; no parent journey | Prompt hash/safe-prompt retention exists; `parentConsentState` defaults `not_required`; unit tests only | No age assurance, consent enforcement, deletion UX, payment/link/upload restrictions; **P0 child beta** |
| Production operations | `UNSAFE` | API start validates only `PORT` | DB fails in production when URL absent; most providers lazy-fail; two CI workflows only | No full startup validation, monitoring/email/reconciliation/migration/deploy/runbook verification; **P0** |

## 5. Ten largest launch blockers

1. **P0 — No server-side generation entitlement reservation:** guests and users reach the expensive model before any credit check.
2. **P0 — Stripe fulfillment is cookie/success-route based:** there is no mounted webhook handler, signature verification, durable event dedupe, or transactional credit grant.
3. **P0 — No first-free-skin entitlement:** `FREE_LIMIT` is zero and generation is instead unlimited.
4. **P0 — Active Roblox OAuth stores access and refresh tokens plaintext inside a merely signed browser cookie:** confidentiality is absent; `SESSION_SECRET` silently falls back to `dev-secret`.
5. **P0 — No current five-view provider/human evidence:** browser execution failed locally and staging is manual/secret-gated with no supplied result.
6. **P0 — Child/parent controls are not server-enforced:** no age/guardian state gates payment, OAuth, download, upload, or publication.
7. **P0 — Real Roblox delivery is unverified:** active upload uses an explicitly unsupported/legacy-risk endpoint and lacks persistent idempotent state.
8. **P0 — 3D Roblox production is absent:** no rig, weights, cages, technical validator, Studio test, or submission.
9. **P0 — Marketplace lifecycle is absent:** no eligibility, moderation polling, listing configuration, publication, or on-sale truth state.
10. **P1 — Production configuration/operations fail incompletely:** only `PORT` and production DB import are fail-fast; provider, storage, Stripe, OAuth, monitoring, mail, and catalog configuration are not coherently validated.

## 6. AI generation status

### Active trace

`Create.tsx generate()` → `apiPost('/ai/generate')` → router safety middleware → `aiGenerationService.generateDesign()` → Creative Intelligence concept generation/ranking → model normalization and faithfulness checks → `modelItemsToUniversalOutfitSpec()` → client canonical projection/materialization → semantic Classic zone layers and provider hero/fabric images → AvatarPreview → five data-URL views → authenticated `/ai/visual-review` → categorical lifecycle.

**Classification: `IMPLEMENTED_NOT_REAL_TESTED`.** Code implements adaptive breadth, multiple concepts, selected hero/silhouette/material directions, stable IDs and revision preservation, protected-IP rewrite/block, exact requested-item faithfulness, explicit unsupported state, and an AssetRouter that does not silently substitute a hoodie. Structural output is deliberately `NEEDS_REPAIR`/`external_verification_required`, not `READY`.

Important failures/ambiguities:

* `/ai/generate` permits guests and performs no entitlement check.
* `/ai/hero-image` also permits guests and performs separate expensive calls.
* Legacy `/ai/generate-outfit` and `/ai/remix-outfit` remain mounted; the canonical route is not the only AI surface.
* Provider calls show no explicit `AbortSignal`/application timeout or reservation release contract.
* Safe provider errors return generic 500/502, but there is no durable cost/retry/idempotency orchestration.
* The same generated top image is applied to front, back, and both sleeves; semantic layers can differ, but provider textile artwork does not inherently provide front/back distinction.
* Deterministic fixtures are isolated by Playwright route interception, but there is no production guard proving fixture payloads cannot be injected through deployment configuration.
* Real generation/provider execution and manual approval: **not evidenced**.

## 7. Visual quality status

**Architectural level: `ARCHITECTURE_ONLY` for launch evidence** (the code has deterministic five-view test architecture, but this audit could not establish `DETERMINISTIC_BROWSER_VERIFIED` at the current commit because Chromium was absent and no trusted current CI artifact was provided).

Implemented: exact labels `front`, `side`, `back`, `front_45`, `back_45`; `preserveDrawingBuffer: true`; generation ID and item IDs; categorical schema; defects; localized directives; attempts 1–3; manual-review fallback; no public numeric reviewer score; failure maps to `external_verification_required`; normal PR workflow and live staging workflow are separated, and staging requires `RUN_STAGING_VISUAL_REVIEW=true` plus secrets.

Not verified/implemented end-to-end:

* No durable evidence manifest, browser version, reviewer result, defects, repairs, and final state are transactionally stored with the generation in production.
* Reviewer repair directives are returned, but `Create` only reads `status` and `defects`; it does not translate `adjust_proportions`, placement/material/construction/clipping, or texture directives into bounded live mesh/texture mutations and resubmit.
* The deterministic benchmark route explicitly mocks `READY`; thus it proves lifecycle wiring, not reviewer quality.
* No result should become complete without explicit READY in active Create logic, but this has not been real-provider/browser verified here.
* Seven benchmark families are encoded: rune knight, ordinary clothing, moonlight princess, storm pirate, asymmetric neon robot, football kit, original web-inspired superhero. No current screenshots exist in the tracked repository; generated test directories were absent initially, and no manual-review record exists.

## 8. First free skin status

**Classification: `MISSING`.** A guest can generate without identity or reservation. Authenticated generation persists a result but does not create/capture a free entitlement. `FREE_LIMIT=0` pertains to upload/download consumption and is cookie-only. There is no trace satisfying identity → grant → reserve → qualify → capture → free preview → paid export/delivery.

Duplication protection is therefore absent for refresh, local-state clearing, guest reset, registration, OAuth reconnect, concurrent requests, replay, tabs, callback retry, generation retry, and repair retry. A privacy-preserving solution should bind the grant to an internal account with verified guardian/email rules appropriate to jurisdiction, use a server-side unique constraint and idempotency key, and avoid invasive child device fingerprinting.

## 9. Credit-limit status

**Classification: `UNSAFE`.** The application cannot prove “exactly three successful generations then block the fourth.” The 3-credit pack funds an HTTP-only numeric cookie used by `/payments/consume-free`, while AI generation never calls it. Consumption happens immediately, not as reserve → qualify → capture/release. Multiple in-flight requests can read the same cookie and each succeed. Browser cookie rollback/replay can restore balance. Repairs and provider failures have no ledger relationship.

No route enforces the required order before model cost. Mutable `users.credits`, `user_profiles.aiCredits` (default **10**), and cookie `skinPaidCredits` are conflicting numeric sources of truth.

## 10. Entitlement-ledger status

**Classification: `PARTIAL`.** `credit_transactions` supports only `purchase|usage|refund`, a signed quantity, optional NOK amount, unique Stripe session, upload ID, and creation time. It lacks credit type, full source/source ID, idempotency key, generation/artifact/promo/payment identifiers, reservation status, expiry, reversal reference, chargeback/support/admin/free-first semantics, and append-only enforcement.

`entitlements` is a generic key/source/status row but is not used for generation. Required credit types and transaction types are not encoded. There is no atomic available-balance query/row lock or serializable reservation transaction. Race and double-spend risk is launch-blocking.

## 11. Promotion-code status

**Classification: `PARTIAL`.** The DB and pure validator provide normalized-looking code records, active window, total/per-user limits, campaign name, target, and percent/fixed discount. The only target enum is `roblox_upload_credit|subscription_plan|beta_invite`; the required generation/export/3D/bundle grants do not exist. There is no redemption API/UI, atomic counter/unique user constraint, eligibility engine, brute-force rate limit, append-only audit grant, admin/support grant, or integration with credits.

Responsibility boundary:

* **A. Internal My Skins code:** must atomically create entitlement-ledger grants without Stripe. Missing.
* **B. Stripe Promotion Code:** should discount Checkout and be validated by Stripe. `allow_promotion_codes` is absent.
* **C. 100% Stripe Checkout:** remains a Stripe session/webhook event (often no paid PaymentIntent); fulfillment must handle it idempotently. Missing.
* **D. Admin grant:** authenticated support action writing an audited ledger transaction, never a Stripe coupon. Missing.

## 12. Pricing status

**Classification: `UNSAFE`.** Active backend fallback is **NOK 10.00 for three upload/download credits**, with a hard-coded Stripe Payment Link and lazy Product/Price creation. `/credits` reports `unitPriceNok: 10`, potentially implying a per-credit amount. UI translations describe uploads rather than generation entitlements. No separate 2D/3D/export/delivery catalog, tax behavior, Price ID environment mapping, or authoritative server catalog exists; Stripe Payment Link contents can differ from hard-coded display values.

A EUR/USD 0.50 card transaction is generally unsuitable as a standalone purchase because fixed card fees can dominate. Treat it as internal unit economics inside a prepaid bundle, subject to Stripe’s actual country/method pricing. Launch-safe recommendation (not an implementation): one currency per configured market, server-authoritative Stripe Price IDs, a clearly described multi-generation pack, separate 2D export/delivery entitlements, no 3D/Marketplace SKU until validated, automatic tax decision, and explicit Roblox-fee exclusion. Price after measured AI generation + five reviews + repair retries + storage/egress + FX/VAT + refunds/disputes + support; do not infer margin from token price alone.

## 13. Stripe status

**Stripe-specific classification: `UNSAFE`.** Flow is Create → create session → redirect → success query → `/payments/verify` → cookie increment. It lacks verified webhook fulfillment.

* Test/live separation: connector determines credentials; no explicit mode/catalog assertion.
* API version: not pinned visibly in `stripeClient` construction.
* Metadata/user identity/customer reuse/idempotency: absent.
* Promotion codes: absent.
* Success/cancel URLs: derived from forwarded Host/Proto without an allowlisted `APP_URL`.
* Signature verification/event dedupe: no webhook route handler despite raw-body middleware.
* Refund/dispute/chargeback/failure/zero-cost/out-of-order/reconciliation: absent.

Explicit answers:

* **Can payment grant twice?** Yes in the system-level threat model: dedupe is a bounded, replayable browser cookie and there is no durable unique fulfillment transaction.
* **Can success URL grant credits without verified webhook?** Yes; that is the implemented mechanism after API retrieval.
* **Can customer pay without receiving credits?** Yes: lost/purged pending cookie, redirect failure, connector outage, or more than 20 tracked sessions can break/re-enable fulfillment behavior.
* **Can refund leave credits active?** Yes; no refund/dispute reversal flow exists.
* **Does OAuth return trigger a second payment/charge?** No explicit automatic payment call was found, but redirects/local state are fragile and no idempotent ledger proves invariance.
* **Are exported files preserved across redirects?** Server artifacts are persistent for project export; active Create’s `readyFiles` is local React state and is not proven durable across redirect.

## 14. 2D Classic status

**Domain classification: `BETA_READY`; audit classification: `VERIFIED_BETA_READY`.** `UniversalOutfitSpec` can feed eligible Classic items; server export independently compiles the persisted project to a 585×559 PNG, validates signature/dimensions/MIME/size/alpha/non-empty output, calculates SHA-256, detects prior duplicate hashes, stores private canonical bytes, verifies storage hash, records provenance, and issues a 15-minute signed download. Tests cover shirt-only, pants-only, combined separate/distinct artifacts, invalid dimensions, empty and duplicate output, SSRF avoidance, quarantine/delete, and canonical artifact resolution.

Remaining risks:

* “moderationDecision” and “rightsDecision” are written as `approved` automatically after technical compilation, not provider or human decisions.
* Preview/download identity is asserted by using the same stored object but lacks a real object-store/browser test.
* Current local artifact store configuration is not external cloud evidence; retention/recovery operations are incomplete.
* Front/back and limb semantics are deterministic-tested, but provider top/bottom images are copied across zones, so semantic visual correctness needs human review.
* Export has no entitlement gate, reservation, or paid lock.
* Roblox acceptance/moderation is unverified.

## 15. 3D production status

All current 3D categories classify **`THREE_JS_PREVIEW_ONLY`**; the client can produce a GLB, but “downloadable” does not elevate Roblox readiness.

| Category | Current output | Missing for next class |
|---|---|---|
| Layered clothing | Procedural preview meshes | production topology/UVs, armature/weights, inner & outer cages, deformation and Avatar Setup validation |
| Rigid accessories | Preview mesh groups | attachment definitions, scale/orientation budgets, validated import and asset-type metadata |
| Hair | Preview geometry | attachment, topology/triangle/UV/material validation and moderation submission |
| Footwear | Preview symmetric geometry | Roblox-supported asset structure, rig/cage behavior and Studio validation |
| Wings | Preview attachment-like geometry | valid accessory attachment(s), budgets, import/submission |
| Backpacks | Preview geometry | valid attachment and technical asset validation |
| Complete outfits | Composition of previews | per-asset packaging, rig/cages, compatibility, Creator Hub workflow and moderation |

No evidence establishes topology limits, UV completeness, normals compliance, skin weights, cages, Roblox scale/orientation, Studio import, Avatar Setup, deformation, technical validation, submission, or approval. Real 3D publication is blocked by the absence of a production asset compiler/validator and external Roblox workflow.

## 16. Roblox OAuth status

**Classification: `UNSAFE`.** The active Create flow uses `/api/auth/roblox/login|callback|me|logout|upload`: state and PKCE S256 exist; callback is cookie-bound; scopes are `openid profile asset:read asset:write`; refresh rotation is attempted. It has no OIDC nonce, persistent internal-account binding, token revocation, age/parent approval, or multiple-account policy. Tokens are base64 JSON plus HMAC, **not encrypted**, in a browser cookie; a secret fallback of `dev-secret` is unsafe. Logout deletes locally without calling Roblox revocation.

A separate, authenticated `/api/roblox/login|callback|status|disconnect` stores state and connection in DB and has job orchestration, but tokens are plaintext DB columns and the frontend does not use this route. Duplicate redirect URI expectations invite dashboard/config drift.

Required variables (names only): `ROBLOX_CLIENT_ID`, `ROBLOX_CLIENT_SECRET`, `ROBLOX_REDIRECT_URI` (DB path), `ROBLOX_OAUTH_AUTHORIZE_URL`, `ROBLOX_OAUTH_TOKEN_URL`, `ROBLOX_CLASSIC_UPLOAD_URL`, `ROBLOX_UPLOAD_MODE`, `ROBLOX_UPLOAD_EXECUTION_MODE`, `SESSION_SECRET`.

Creator Dashboard setup: create an OAuth 2.0 app under the qualified creator; register the exact HTTPS callback(s)—prefer one canonical callback, currently either `${APP_URL}/api/roblox/callback` or `${APP_URL}/api/auth/roblox/callback`; allow only the required scopes (`openid profile asset:read asset:write` after Roblox confirms actual Classic support); configure permitted production/staging origins/redirects separately; keep the client secret server-only; record owner/group eligibility; and run consent, denial, refresh/rotation, revocation, and account-switch tests using dedicated test creators.

## 17. Roblox delivery status

**Classification: `PARTIAL`.** Two paths:

1. Active `/auth/roblox/upload`: accepts browser data URL, bearer token, type 2/11/12, and calls `itemconfiguration.roblox.com/v1/avatar-assets/{typeId}/upload`. It validates only prefix, name, and ≤4 MiB—not canonical dimensions/hash/provenance, ownership, entitlement, idempotency, async operations, or moderation. Success returns optional `assetId` only.
2. DB `/roblox/upload`: requires authenticated owned project, completed canonical export, supported Classic shirt/pants, OAuth connection, creates a job/event trail, can refresh and retry, and distinguishes configured/failed/completed. It can be configured for mock fallback and relies on a configurable Classic endpoint. No real evidence exists.

Neither implements actual 3D upload. States do not establish moderation pending/approved/published/on sale. Artifact preservation is stronger only in the DB path. Delivery credit reservation/capture/release is absent from both. OAuth return preservation for active browser-generated files is not proven.

## 18. Marketplace sale status

**Classification: `MISSING`.** There are no creator eligibility/group ownership/identity/membership checks, listing metadata, price, moderation poll, publication transition, sale state, or rejection workflow.

Expected truthful workflows:

* Classic 2D: My Skins validated download (or only after real API verification, upload-submitted) → Roblox Creator Hub → Roblox fee/creator requirements → moderation → creator configures availability/price if eligible → published → on sale.
* Layered clothing/accessories: My Skins production package (not currently available) → Studio/Avatar Setup technical validation → Creator Hub upload → eligibility/fees/moderation → Marketplace listing → on sale.

No state may collapse downloaded/requested/accepted/uploaded/moderation pending/approved/published/on-sale.

### Payment/Roblox-fee wording

Current UI must add, before any paid launch: “Payment buys My Skins credits only”; “Roblox may charge separate upload/publication fees”; “Roblox decides moderation and eligibility”; “upload does not mean published or on sale”; “Marketplace approval/revenue is not guaranteed”; “3D downloads are previews unless explicitly technically validated”; and a parent/qualified creator must handle payment/account/publication where required.

## 19. Child and parent safety

**Classification: `PARTIAL`.** Server safety detects length, PII, disallowed sexual/self-harm/extreme violence/hate/drug content, IP references, and rate limits; image output moderation fails closed. Auth and owned-project checks protect DB exports/upload jobs. Prompt persistence intends safe normalized forms and a retention sweeper.

UI-only or absent: age policy/assurance, guardian identity/consent, payment approval, promo authorization, Roblox linking permission, export/upload/publication/sale gates, privacy settings, child-accessible deletion request, verified retention for every image/object/log, parent handoff, and qualified creator verification. `artifact_objects.parentConsentState` defaults to `not_required` and no enforcement was found. Cookie OAuth operates independently of internal identity.

Launch blockers: adopt professional-reviewed Terms/Privacy/child policy; data map and retention/deletion SLA; guardian consent/notice where legally required; server-side age/guardian authorization gates; restricted defaults; payment refund/support journey; Roblox/Stripe data-processing analysis; moderation/escalation and incident handling.

**This report is engineering/product risk analysis, not legal advice.** Obtain qualified counsel for COPPA, GDPR/UK GDPR age-appropriate design, consumer law, VAT/tax, biometrics/device identifiers, payment terms/refunds, Roblox terms/API use, IP/licensing, Marketplace disclosures, and jurisdiction-specific parental consent.

## 20. Security findings

### P0

* Generation/provider endpoints lack server entitlement/idempotency enforcement, enabling cost abuse.
* Stripe credits are fulfilled and deduplicated in replayable browser cookies, with no signed webhook/durable transaction.
* Active Roblox bearer/refresh tokens are confidential data stored unencrypted client-side in a signed cookie; `SESSION_SECRET` has an unsafe default.
* No server-enforced child/guardian authorization for payment, OAuth, upload, or publication.
* Active direct Roblox upload accepts arbitrary ≤4 MiB PNG data URLs without canonical image decode/dimension/hash/provenance checks and no idempotency.

### P1

* `cors({credentials:true, origin:true})` reflects arbitrary origins; cookie-changing POSTs have no explicit CSRF token/origin allowlist.
* Checkout base URL trusts forwarded host/proto rather than validated `APP_URL`.
* DB Roblox tokens are plaintext; no envelope encryption/key rotation.
* Logout/disconnect does not invoke provider revocation.
* In-memory safety rate limiting is instance-local and unsuitable for autoscale abuse prevention.
* No promo redemption endpoint exists, but its eventual implementation lacks DB uniqueness/atomic counters today.
* No security headers/CSP middleware was found.
* Object storage local signed URLs use application endpoints/design; external-store ACL and cross-tenant tests are not evidenced.
* Logging truncates some Roblox provider bodies but may retain provider detail/error data; formal redaction rules and child-data observability controls are not verified.
* No dependency/security scanning workflow, incident alerting, secret scan, SAST, or production audit trail was found.

SSRF is positively addressed in the Classic compiler tests (remote URLs are not fetched). Authentication ownership checks exist on project/export/DB upload routes, but the duplicate cookie OAuth path bypasses internal-account authorization.

## 21. Production configuration

**Classification: `UNSAFE`.** Startup fail-fast verifies `PORT`; DB import deliberately fails in production without `DATABASE_URL`. Everything else is lazy or absent.

Required/referenced names without values: `PORT`, `NODE_ENV`, `DATABASE_URL`, `OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`, `SESSION_SECRET`, `ROBLOX_CLIENT_ID`, `ROBLOX_CLIENT_SECRET`, `ROBLOX_REDIRECT_URI`, `ROBLOX_OAUTH_AUTHORIZE_URL`, `ROBLOX_OAUTH_TOKEN_URL`, `ROBLOX_CLASSIC_UPLOAD_URL`, `ROBLOX_UPLOAD_MODE`, `ROBLOX_UPLOAD_EXECUTION_MODE`, `REPL_ID`, `REPL_IDENTITY`, `REPLIT_CONNECTORS_HOSTNAME`, `WEB_REPL_RENEWAL`, `ISSUER_URL`, `API_SERVER_URL`, `LOG_LEVEL`, `STAGING_BASE_URL`, `STAGING_SESSION_COOKIE`, `RUN_STAGING_VISUAL_REVIEW`.

Missing coherent production contract: `APP_URL`; Stripe publishable/secret/webhook secrets and explicit Price IDs/mode; storage bucket/region/credentials and encryption key; Roblox scopes; monitoring/trace/error DSNs; alert routing; transactional email; retention/deletion feature flags; provider timeout/budget controls; staging-only flag assertions. Production does **not** fail safely for all critical missing/mismatched configuration.

## 22. CI and test results

Commands were run from `/workspace/My-Skins-` on the audited commit before this report.

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS; lock current; warning that `canvas@3.2.2` build script is ignored. |
| `pnpm typecheck` | PASS. |
| `pnpm test:unit` | PASS: API 153/153; web 63/63. |
| `pnpm test:integration` | PASS: 23/23. |
| `pnpm test` | PASS; repeats unit + integration. |
| `pnpm run build:packages` | PASS; sourcemap diagnostic and web chunk >500 kB warnings. |
| `pnpm build` | PASS; typecheck + builds, same warnings. |
| `pnpm exec playwright test --list` | PASS: six listed (five normal, one staging). |
| `pnpm exec playwright test --config=playwright.staging.config.ts --list` | PASS: one staging test. |
| `pnpm exec playwright test` | ENVIRONMENT FAILURE: five failed at browser launch because Chromium headless shell 1187 is absent; staging test skipped. No browser assertions ran. |
| `pnpm exec prettier --check .` | FAIL: 291 files reported formatting issues; includes generated/report directories present during check. |
| `git diff --check` | PASS before report. |
| `git status --short` | Initially clean; Playwright outputs were removed; this report is the intended final change. |

Coverage assessment: deterministic tests cover Classic validation, lifecycle helpers, promo validator, OAuth/upload helpers, visual schema and unavailable/READY fixture behavior. Missing executable coverage for first-free grant, zero/exhausted/fourth blocked, reservation/release/concurrent generation, atomic promo redemption/expiry duplicate, all real Stripe outcomes (success/cancel/duplicate/refund/dispute/zero-cost), real OAuth success/denial/state/refresh/disconnect/revoke, redirect artifact persistence, real 2D delivery/moderation, all 3D/Marketplace states, and parent restrictions. Staging-provider isolation is covered structurally; external provider outcome is not.

Latest workflow source was inspected, but GitHub run/artifact availability was not evidenced from the repository; therefore no CI artifact is treated as proof.

## 23. Manual external tests

Use dedicated staging accounts, Stripe test mode, a Roblox test creator/group, a clean database, isolated object bucket, and correlated IDs. Record timestamps, request IDs, ledger rows, webhook event IDs, screenshots, provider operation/asset IDs, and cleanup.

1. **New free grant:** register one eligible new account; query ledger; assert exactly one `FREE_FIRST_SKIN/GENERATION` grant and no duplicate after relogin.
2. **Free preview:** reserve the grant, generate a provider result that reaches categorical READY, capture once, view preview, assert no export/delivery entitlement consumed.
3. **Paid download lock:** request signed download without export credit; expect 402/entitlement-required and no URL.
4. **Paid delivery lock:** request Roblox delivery without delivery credit; expect blocked before provider call.
5. **Three credits:** buy a 3-generation pack; complete three READY generations with distinct idempotency keys; assert balance zero and three captures.
6. **Fourth blocked:** send a fourth plus parallel replay; expect deterministic 402 before any provider request.
7. **Failure release:** force provider timeout/invalid output; assert reservation RELEASE and original balance restored.
8. **Repair charge:** force NEEDS_REPAIR then READY; assert one reservation/capture for the generation and no repair debit.
9. **Internal promo once:** redeem normalized spelling/case of free-skin code; assert atomic bundle grant and second redemption conflict.
10. **Expired promo:** set expiry in past; assert rejection/no ledger write (except audit attempt if designed).
11. **Stripe promotion:** apply configured restricted Promotion Code; verify Checkout totals/tax and webhook metadata.
12. **Stripe success:** complete test payment; assert signed webhook creates one purchase transaction and balance updates after redirect-independent polling.
13. **Cancel:** cancel Checkout; assert no grant and artifact/design remains.
14. **3DS:** use Stripe 3DS test card; authenticate; verify delayed completion and one grant.
15. **Duplicate webhook:** replay identical signed event concurrently; assert one processed-event and one grant.
16. **Refund:** refund purchase; assert policy-compliant reversal of unused credits, no negative/unsafe state, support audit.
17. **OAuth success:** connect staging internal account to expected Roblox test user; verify `sub`, encrypted token storage, scopes and UI identity.
18. **OAuth denial:** deny consent; assert safe error, no connection/token, original artifact preserved.
19. **Invalid state:** alter/replay state; assert rejection, state consumed/expired, no token exchange.
20. **Refresh:** expire access token; perform authorized action; assert rotated encrypted refresh token and old token handling.
21. **Disconnect:** disconnect; verify provider revocation where supported, local deletion/invalidation, and subsequent action rejected.
22. **Return preservation:** begin OAuth from a persisted artifact; finish/deny; assert same artifact ID/hash and no credit charge.
23. **2D download:** download signed shirt and pants; decode PNG; verify 585×559, alpha, MIME, SHA, and preview byte identity.
24. **2D delivery:** submit canonical artifacts once; poll operation; record asset IDs, moderation pending, retry idempotency, and Roblox Creator Hub visibility.
25. **3D label:** inspect every preview/download screen; assert “preview/not Roblox-ready” until technical validation exists.
26. **3D Studio handoff:** import a candidate manually; record validation failures; UI must not elevate status beyond candidate.
27. **Moderation:** move real test asset through pending/approved/rejected; assert exact states and rejection reason/retry policy.
28. **Marketplace eligibility:** try eligible and ineligible creators/groups; publication/sale controls must remain blocked until provider facts confirm eligibility.
29. **Child restriction:** child account directly calls payment/OAuth/export/upload APIs; assert server denies—not merely hidden buttons.
30. **Parent approval:** complete configured guardian flow; verify scoped, expiring authorization and audit; revoke it and assert later sensitive actions denied.

## 24. Required migrations

1. Immutable `entitlement_transactions` with enums/types, quantity, source/source ID, globally unique idempotency key, generation/artifact/Stripe/promo references, status, expiry, reversal reference, timestamps, and append-only DB permissions/triggers.
2. `credit_reservations` or ledger reservation projections with unique `(user, credit_type, idempotency_key)`, expiry, capture/release linkage, and atomic spend constraints.
3. Unique free-first grant index per eligible identity and eligibility/guardian verification columns.
4. `stripe_events` and `stripe_fulfillments` with unique event/session/payment IDs, processed status/error/retry, catalog snapshot, customer/user binding, refund/dispute reversals.
5. Expand promo targets/grant bundles; add normalized-code unique index, redemption uniqueness, atomic counters/eligibility, grant transaction link and admin audit actor.
6. Replace plaintext Roblox token columns with encrypted ciphertext/key-version fields; connection subject uniqueness and revoke metadata.
7. Consolidate upload jobs with idempotency key, provider operation ID, exact lifecycle states, target user/group, moderation/publication/sale fields and artifact/credit transaction references.
8. Durable visual-review/evidence tables: generation, attempt, browser/version, five immutable view object references/hashes, stable item IDs, response/defects/repairs, reviewer/provider version, human decision.
9. Consent/age-policy/audit tables and artifact/prompt deletion request/tombstone records.

## 25. Required external dashboard changes

* Stripe: separate test/live products and immutable Prices; configure authoritative pack metadata, promotion codes/coupons, tax behavior, customer portal/refund policy; register HTTPS webhook for Checkout completion, async success/failure, refunds, disputes/chargebacks; rotate/store signing secret; alert failed deliveries.
* Roblox Creator Dashboard: one canonical OAuth app per environment, exact HTTPS redirect, minimal confirmed scopes, test users/groups, secret rotation; document creator eligibility and whether the supported API truly accepts each Classic/3D type.
* Object storage: private bucket/service identity, encryption, CORS, lifecycle/retention/deletion, malware/quarantine process, audit logs, backup/recovery.
* OpenAI/model provider: separate staging/prod projects, spend/rate limits, approved models, retention policy, safety monitoring and alerting.
* Replit/deployment: explicit start commands, environment validation, migration release step, health/readiness checks, rollback, monitoring/error alerting, log retention/redaction.
* Legal/support: published Terms/Privacy/refunds/Roblox-fee disclosures, guardian/contact/deletion process, incident escalation and moderation appeal.

## 26. P0–P3 backlog

### P0 — blocks any scoped launch

**P0.1 Atomic generation entitlement lifecycle — XL.** Objective: enforce free-first and paid generation reserve/capture/release before provider use. Root cause: AI routes bypass cookie/DB credits. Files: `routes/ai-v2.ts`, generation service, Create, auth, new ledger service, DB schemas/migrations. Migration: items 1–3 above. API: idempotent generation start/status/retry. Frontend: balance/block/retry state. Tests: new/free, 3 then fourth, concurrent/replay, all release outcomes, repairs. External: database/worker. Acceptance: serializable concurrent tests and provider-call spy prove zero-credit calls never reach provider. Dependencies: identity/consent policy.

**P0.2 Webhook-only Stripe fulfillment — XL.** Objective: durable exactly-once grants and reversals. Root cause: cookie success verification. Files: payments route, stripe client/lifecycle, app raw-body ordering, Create pricing. Migration: Stripe events/fulfillments/ledger. API: catalog checkout, webhook, purchase status. Frontend: poll server status. Tests: signature, duplicate/out-of-order/delay/3DS/zero-cost/refund/dispute. External: products/prices/webhook/tax. Acceptance: redirect cannot grant; 100 concurrent duplicate events grant once. Dependencies: P0.1 ledger.

**P0.3 Consolidate and secure Roblox OAuth — L.** Objective: one internal-account-bound OAuth flow with PKCE/state/nonce, encrypted rotated tokens and revocation. Root cause: duplicate DB/cookie implementations. Files: both Roblox routes, Create, token service, schemas. Migration: encrypted token/key version/subject. API: canonical login/callback/status/refresh/disconnect. Frontend: artifact-bound return. Tests: denial/state replay/refresh/account switch/revoke/CSRF. External: dashboard app/callback/scopes/KMS. Acceptance: no token in cookie/log/plain DB and real staging suite passes. Dependencies: identity/consent.

**P0.4 Child/guardian server policy — XL.** Objective: enforce age-appropriate sensitive-action authorization. Root cause: friendly UI/safety filter without identity/consent gates. Files: auth, payments/exports/Roblox routes, Create/account UI, privacy docs. Migration: consent/audit/deletion. API: guardian approval/revoke and policy middleware. Tests: direct API bypass attempts. External: counsel, email/identity provider. Acceptance: policy matrix is professionally approved and enforced server-side. Dependencies: legal decisions.

**P0.5 Real visual-evidence gate — L.** Objective: durable five-view provider review with applied bounded repairs and human fallback. Root cause: response directives ignored and evidence transient. Files: Create, AvatarPreview, visual review/service/schema, workflows. Migration: visual evidence/review tables. API: attempt upload/review/repair/finalize. Frontend: repair materialization/manual status. Tests: each operation mutates only target, unavailable never completes, provider staging and human sign-off. External: provider/browser/storage/reviewer. Acceptance: seven families have 35 hashed current screenshots, READY provider decisions, and recorded human approval. Dependencies: P0.1 for charging.

### P1 — blocks paid public launch

**P1.1 Paid Classic export entitlement — M.** Objective: reserve/capture export credit only after stored validated artifact. Root cause: `/exports` is free. Files: exports route, ledger service, UI. Migration: ledger artifact reference. Tests: failure release, duplicate/retry idempotency, signed URL access. External: storage. Acceptance: no URL without entitlement; failure costs zero.

**P1.2 Production configuration validator — M.** Objective: fail startup on missing/mixed-mode critical config. Root cause: lazy provider checks. Files: new config module, index, Stripe/Roblox/storage/provider clients. Migration: none. API/frontend: health exposes nonsecret readiness. Tests: matrix of missing/test-live mismatch. External: secret manager/monitoring. Acceptance: production cannot listen unless all enabled capabilities are safely configured.

**P1.3 Internal promo grant service — L.** Objective: atomic generation/export/delivery/bundle grants. Root cause: discount-only pure validator. Files: promo lib/routes, ledger, admin, UI. Migration: expanded target/grant/redemption uniqueness. Tests: normalization/brute force/expiry/limits/concurrency/eligibility/admin audit. External: support RBAC/rate-limit store. Acceptance: one code redeemed 100-way produces one allowed grant.

**P1.4 Pricing/catalog truth — M.** Objective: server-authoritative localized product catalog with fee disclosures. Root cause: hard-coded Payment Link/NOK/UI mismatch. Files: payments, billing schemas, i18n/Create/legal pages. Migration: catalog snapshot/Price mapping. Tests: UI equals Stripe configured price/currency/tax. External: Stripe/tax/counsel. Acceptance: checkout and receipt exactly match displayed product and exclusions.

**P1.5 Security/operations baseline — L.** Objective: origin/CSRF/CSP/rate limiting, encrypted secrets, monitoring, migrations, backups, incident/retention jobs. Root cause: permissive CORS and absent operational pipeline. Files: app/middleware/logger/workflows/deploy docs. Migration: audit/retention jobs as needed. Tests: cross-origin/CSRF/rate-limit/restore/secret scanning. External: Redis/WAF/monitoring/backup. Acceptance: threat-model P0/P1 closed and operational game day passes.

### P2 — required soon after beta

**P2.1 Verified 2D delivery pipeline — XL.** Objective: canonical DB job path submits only Roblox-supported Classic artifacts and polls truthful moderation states. Root cause: active legacy direct path and uncertain API support. Files: Roblox routes/pipeline/Create/jobs. Migration: operation/moderation/idempotency/credit refs. Tests: provider contract sandbox, retry/no duplicate, token loss, target user/group. External: Roblox approval/test creators. Acceptance: multiple shirt/pants assets appear with recorded IDs and truthful moderation states; failed jobs release delivery credit.

**P2.2 Artifact lifecycle and recovery — L.** Objective: redirect-safe artifacts, retention/deletion/quarantine/recovery. Root cause: transient Create files and partial storage metadata. Files: exports/storage/Create/projects/retention. Migration: retention/deletion status. Tests: redirect/relogin/hash/expiry/delete/restore. External: object-store lifecycle/backup. Acceptance: published retention SLA and recovery drill pass.

**P2.3 Marketplace state model/manual handoff — L.** Objective: truthful eligibility/moderation/publication/on-sale records even before automation. Root cause: no domain model. Files: new routes/schema/UI/docs. Migration: listing states and external refs. Tests: monotonic transitions/rejection/ineligible creator. External: Creator Hub procedures. Acceptance: UI never infers sale from upload.

### P3 — improvement

**P3.1 Bundle/code-split frontend — M.** Objective: reduce 1.5 MB JS chunk and mobile startup cost. Root cause: monolithic Three/editor imports. Files: App/Create/routes/Vite. Migration/API: none. Tests: bundle budgets and mobile performance. External: RUM. Acceptance: agreed LCP/bundle budget.

**P3.2 Formatting/lint baseline — S.** Objective: deterministic format/lint gate. Root cause: 291 Prettier warnings and no lint script. Files: workspace config and existing sources. Migration/API/frontend: none semantically. Tests: `prettier --check` and lint in CI. External: none. Acceptance: clean commands without changing runtime behavior.

**P3.3 3D research track — XL.** Objective: create one Roblox Studio import candidate before promising 3D delivery. Root cause: preview geometry only. Files: future server compiler/validator and truthful UI. Migration: 3D artifact evidence. Tests: topology/UV/normals/rig/cages/weights/budgets. External: Blender/Studio/Avatar Setup/test upload. Acceptance: one narrowly scoped asset passes documented technical checks; still not Marketplace-ready until moderation.

## 27. Definition of done for closed beta

* P0.1–P0.5 complete; no payments/Roblox features exposed unless separately verified.
* Browser suite runs on every target commit; seven families/35 views archived and human-approved.
* Free-first grant, zero-credit stop, failure release, and repair idempotency pass concurrency tests.
* Professional child/privacy review complete; guardian rules server-enforced; deletion/support/incident paths operational.
* Production configuration, migrations, private storage, monitoring, rate limits, backups/rollback verified.
* Beta wording limits 3D to preview and 2D to validated download; no delivery/Marketplace promise.

## 28. Definition of done for paid launch

Closed-beta DoD plus webhook-only Stripe exactly-once fulfillment/reversal/reconciliation; test-mode and limited live-mode end-to-end evidence; authoritative catalog/tax/currency/refund disclosures; paid export entitlement; internal and Stripe promotions tested; security review and operations game day; support and financial reconciliation procedures; all P0/P1 closed.

## 29. Definition of done for 2D Roblox delivery

Canonical stored 585×559 shirt/pants only; provider-confirmed supported endpoint/scope; encrypted OAuth; owned user/group target; idempotent delivery reservation; async operation/asset ID polling; truthful submitted/uploaded/moderation/approved states; failure release; redirect preservation; real test-creator uploads across shirt-only/pants-only/full outfit; Creator Hub inspection and recorded moderation outcomes; no claim of publication/sale.

## 30. Definition of done for 3D Roblox delivery

For each advertised asset class: versioned production exporter; topology/UV/normals/material/texture/scale/orientation budgets; appropriate rig/weights/cages/attachments; repeatable Studio and Avatar Setup validation/deformation; canonical stored package/hash/provenance; supported authenticated submission and operation polling; real test asset IDs and moderation; truthful class-specific limitations. A Three.js/GLB preview alone never meets this DoD.

## 31. Definition of done for Marketplace sale

Creator/user/group eligibility and identity requirements verified from Roblox; asset technically validated and uploaded; moderation approval observed; listing metadata/price/fees/rights captured; publication request/result and on-sale state independently polled; rejection/appeal/unpublish/refund/support behavior; clear My Skins-vs-Roblox fees and no revenue guarantee; real eligible test listing documented per asset class. Manual handoff must be labeled manual until automation is provider-verified.

## 32. Exact next implementation milestone

**Milestone: “Server-authoritative free-first generation ledger, with no Stripe or Roblox exposure.”** Implement the append-only typed ledger and atomic generation reservation/capture/release; bind exactly one free generation to an authenticated eligible internal identity; require idempotency on generation and repairs; block before all model/image calls at zero; capture only after explicit categorical READY; release on provider timeout, schema/technical failure, UNSUPPORTED, safety rejection, and non-READY terminal outcome; display server balance; add concurrent/replay/fourth-generation tests and a browser test. Deploy only to an internal environment with Stripe and Roblox feature flags off. This is the smallest milestone that repairs the core product promise and creates the prerequisite for safe payments, promos, export, and delivery.
