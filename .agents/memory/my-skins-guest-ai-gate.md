---
name: Guest AI free-use gate
description: How the "1 free AI generation for guests, then log in" rule is enforced in my-skins.
---

# Guest AI free-use gate (my-skins)

Product rule: anyone can use the AI design function (describe clothes+gear → appears on
avatar) WITHOUT an account, but only ONCE. After that, log in (then Stripe pays for more).
Saving and exporting/deploying to Roblox always require login.

## Enforcement (two layers)
- **Server (real gate):** `POST /api/ai/generate` permits unauthenticated callers when the
  HttpOnly cookie `guestAiUses` is below limit 1. On a successful generation it sets/
  increments the cookie. A guest already at the limit gets `401 { code: "guest_ai_limit" }`.
  The cookie increments **only on success**, so failed generations don't burn the free use.
  All other `/ai/*` routes stay auth-gated.
- **Client (UX):** `Editor.tsx generateAiPlan` has an in-flight guard, a `localStorage`
  `guestAiUses` pre-check that opens the login dialog, increments only on success, and a
  catch branch that opens the login dialog on `status===401 || data.code==="guest_ai_limit"`.

## Guest history persistence
`aiGenerationService.generateDesign(userId: string | null)` skips `saveGeneration` (DB
history insert) when `userId` is null (guest) and returns a random UUID generationId —
otherwise a guest would violate the `ai_generations.userId` FK.

**Why this is acceptable:** The cookie/localStorage limit is a **soft per-browser** gate,
trivially bypassed (clear cookies / incognito / new browser). That's fine because it's UX
friction, not abuse prevention — the real money gate is save/export/deploy, which stays
properly auth-gated behind login + Stripe. If AI cost-abuse rises, add server-side IP/device
rate limiting on `/api/ai/generate`.
