---
name: my-skins SafetyGateway
description: Durable decisions behind the child-safety filter on AI prompts.
---

# SafetyGateway decisions

- **Characters vs. brands:** protected characters ("lag Spider-Man") are silently REWRITTEN
  into an original safe alternative that keeps broad attributes — the child's request still
  succeeds. Brand/logo requests are BLOCKED (`IP_RESTRICTED`). **Why:** a logo request is
  always a copy request; a character request is a wish to *be* something, which we can honor safely.
- **Deterministic moderation:** wordlists (NO+EN, word-boundary, unicode) instead of an
  external moderation API. **Why:** unit-testable offline, no latency/cost/dependency on
  every child keystroke; obvious trade-off is recall — output-side moderation is the planned complement.
- **Data minimization:** the gateway rewrites req.body in place so downstream storage only
  ever sees the normalized safe form; hash + decision travel via an in-memory registry, not
  request plumbing. **Why:** no raw child prompts must ever be persisted or logged.
- **Migrations here are manual SQL files** in `lib/db/migrations` (no runner) + `drizzle-kit push`
  for the dev DB; any schema change needs BOTH or reviewers flag a deploy break.

**How to apply:** new AI routes under `/api/ai/*` are auto-covered; new child-written
free-text fields must be added to the middleware's TEXT_FIELDS list.
