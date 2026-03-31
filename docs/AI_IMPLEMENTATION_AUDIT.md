# My Skins — AI Implementation Audit (Roblox Clothing)

## Scope
Audited AI behavior across backend routes, frontend callers, response contracts, and prompt design for Roblox classic shirt/pants workflows.

---

## 1) AI-related code map

### Backend API routes
- `artifacts/api-server/src/routes/ai.ts`
  - `POST /ai/generate`
  - `POST /ai/generate-idea`
  - `POST /ai/generate-listing`
  - `POST /ai/improve`
  - `POST /ai/palette`
  - `GET /ai/history`
- `artifacts/api-server/src/routes/ai-create.ts`
  - `POST /ai/quick-create` (creates project + canvas from AI concept)

### OpenAI integration
- OpenAI client wiring in `lib/integrations-openai-ai-server/src/client.ts`.
- All clothing text routes currently use `openai.chat.completions.create(...)` with model `gpt-5.2`.

### Frontend callers
- `artifacts/my-skins/src/components/editor/AiPanel.tsx`
  - calls `/api/ai/generate-idea`, `/api/ai/generate-listing`, `/api/ai/improve`, `/api/ai/palette`
- `artifacts/my-skins/src/pages/Dashboard.tsx`
  - calls `/api/ai/quick-create`

### Specs / generated API client
- OpenAPI currently documents only `/ai/generate`, `/ai/palette`, `/ai/history`.
- Frontend uses direct `fetch()` for endpoints not in generated client.

---

## 2) Why results are currently weak

1. **Unreliable JSON contract (string extraction + parse fallback)**
   - Backend prompts say “valid JSON only”, but then parse by regex (`/\{[\s\S]*\}/`) and silently fall back to partial objects when parsing fails.
   - This hides model-format errors and produces inconsistent shape.

2. **No schema validation for AI response payloads**
   - Parsed AI output is treated as trusted data and returned to UI.
   - Missing required fields (e.g., palette hexes, placement data, listing limits) are not validated.

3. **Prompt goals are broad, not Roblox-template constrained**
   - Most prompts ask for generic “design description” and tags, but do not force template-aware layout guidance (front/back/sleeves/legs), symmetry, seam continuity, or print-safe constraints.

4. **Inconsistent endpoint architecture**
   - There are overlapping endpoints (`/ai/generate`, `/ai/generate-idea`, `/ai/quick-create`) with different shapes and intents.
   - `quick-create` directly builds fabric JSON from partially constrained concept data, so low-quality concept => low-quality generated canvas.

5. **API spec drift from runtime implementation**
   - OpenAPI + generated client omit key routes (`generate-idea`, `generate-listing`, `improve`, `quick-create`).
   - Frontend bypasses typed client and uses raw fetch, reducing type safety and discoverability.

6. **Frontend expects optional fields everywhere**
   - `AiPanel` interfaces are mostly optional. UI renders “whatever exists” and does not strongly validate or normalize data.
   - This masks low-quality outputs instead of prompting repair/retry behavior.

7. **Error handling is generic and non-diagnostic**
   - User sees “Failed to generate” with no structured error type (validation error vs model refusal vs malformed JSON).

8. **No request-side constraints for generation context**
   - Missing required domain inputs such as garment section focus, target audience, color count bounds, style intensity, complexity, and allowed motifs.

---

## 3) Prompt-by-prompt evaluation and rewrites

### A) `/ai/generate-idea`
**Current issue:** prompt asks for broad creative text; no placement schema; no enforceable Roblox layout semantics.

**Better prompt (system):**
- “You are a Roblox classic clothing designer. Output strict JSON for template-ready ideation. Do not include markdown. Respect Roblox classic clothing context.”

**Better prompt (user template):**
- Include explicit fields: `type`, `style`, `theme`, `allowedText`, `mustInclude`, `avoid`, `complexity`.
- Require output shape:
```json
{
  "title": "...",
  "style": "...",
  "colorPalette": ["#...", "#...", "#...", "#...", "#..."],
  "designElements": ["..."],
  "placement": {
    "front": "...",
    "back": "...",
    "sleeves": "..."
  },
  "robloxNotes": ["seam continuity note", "readability note", "symmetry note"]
}
```

### B) `/ai/generate-listing`
**Current issue:** asks for title/description/tags but no marketplace-safe normalization (length checks, prohibited claims, tag dedupe).

**Better prompt:** require strict lengths and style-aware keywords.
```json
{
  "title": "max 40 chars",
  "description": "2 sentences, max 220 chars",
  "tags": ["exactly 6 lowercase tags"],
  "category": "Shirts|Pants",
  "priceRange": { "min": 5, "max": 15 }
}
```

### C) `/ai/improve`
**Current issue:** scoring/improvement format exists but not tied to Roblox garment regions; suggestions can be generic.

**Better prompt:** require region-specific critique.
```json
{
  "score": 1,
  "issues": [
    {"region":"front|back|sleeves|legs", "problem":"...", "impact":"...", "fix":"..."}
  ],
  "revisedPlan": {
    "front":"...",
    "back":"...",
    "sleeves":"..."
  },
  "nextSteps": ["..."]
}
```

### D) `/ai/quick-create`
**Current issue:** still text-heavy concept prompt; generated canvas builder is deterministic but simplistic and not truly template-mapped artistry.

**Better prompt:** optimize for machine-usable fields only (short strings, bounded arrays), plus text placement constraints and line-break rules. Avoid long prose unless needed.

---

## 4) Recommended architecture (practical)

1. **Keep separate endpoints (good direction) but normalize contracts**
   - `POST /ai/generate-idea`
   - `POST /ai/improve-design`
   - `POST /ai/generate-listing`
   - `POST /ai/quick-create` (optional orchestration endpoint)

2. **Use structured outputs with strict schema on backend**
   - Generate with JSON schema response format.
   - Validate with Zod before returning to UI.
   - On validation failure, perform one “repair” call with validation errors.

3. **Define shared domain DTOs**
   - `AiIdeaResponse`, `AiImproveResponse`, `AiListingResponse` in one shared package (`api-zod` or dedicated `lib/ai-contracts`).

4. **Rebuild OpenAPI + generated client**
   - Add missing routes and schemas so frontend stops using ad-hoc fetch.

5. **Frontend normalization layer**
   - Parse and sanitize response once; reject incomplete data with user-visible guidance.

---

## 5) Example backend code shape (improved)

```ts
const AiIdeaSchema = z.object({
  title: z.string().min(3).max(60),
  style: z.string().min(2).max(40),
  colorPalette: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).length(5),
  designElements: z.array(z.string().min(2).max(60)).min(3).max(8),
  placement: z.object({
    front: z.string().min(10).max(240),
    back: z.string().min(10).max(240),
    sleeves: z.string().min(10).max(240),
  }),
});

const completion = await openai.responses.create({
  model: "gpt-5.2",
  input: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(requestPayload) },
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "ai_idea_response",
      schema: /* JSON schema generated from AiIdeaSchema */,
      strict: true,
    },
  },
});

const raw = completion.output_text;
const parsed = AiIdeaSchema.parse(JSON.parse(raw));
res.json(parsed);
```

---

## 6) Request/response examples

### Request (generate-idea)
```json
{
  "type": "shirt",
  "style": "streetwear",
  "theme": "dragon graffiti",
  "allowedText": "DRAGON KING",
  "mustInclude": ["gold flames", "black base"],
  "avoid": ["skulls"],
  "complexity": "medium",
  "language": "en"
}
```

### Response
```json
{
  "title": "Dragon King Street",
  "style": "streetwear",
  "colorPalette": ["#101114", "#D4AF37", "#F04E23", "#ECECEC", "#2A2D34"],
  "designElements": ["graffiti dragon outline", "flame hem", "gold chest lettering"],
  "placement": {
    "front": "Large DRAGON KING text centered with flame underline.",
    "back": "Dragon spine motif with thinner linework.",
    "sleeves": "Alternating flame stripes that align at seams."
  }
}
```

---

## 7) Frontend fixes (AI panel + apply flow)

1. **Mode-specific forms instead of one generic textarea**
   - Idea: fields for item type, theme, must include, avoid, text on garment.
   - Listing: fields for idea + audience + tone.
   - Improve: fields for current design summary + known problems.

2. **Strong rendering contracts**
   - Replace optional-heavy interfaces with required fields after validation.
   - If invalid, show “AI response incomplete” card + retry button.

3. **Apply-to-design flow**
   - Add explicit action buttons:
     - “Apply Palette to Current Canvas”
     - “Insert Front Text”
     - “Create New AI Draft Project”
   - Show preview of which canvas regions will be affected.

4. **User-visible diagnostics**
   - Surface validation errors (e.g., “Expected 5 HEX colors, got 2”).

---

## 8) Step-by-step fix plan

1. Add shared Zod schemas for all AI endpoint responses.
2. Switch AI endpoints to structured JSON schema output.
3. Validate + repair once on schema failure; otherwise return 422 with details.
4. Update OpenAPI with all AI routes and regenerate API client.
5. Replace raw fetch in AI panel/dashboard with generated typed client hooks.
6. Refactor AI panel inputs by mode and enforce required fields.
7. Add “apply-to-design” actions mapped to canvas operations.
8. Add logging metrics: parse_fail_rate, schema_fail_rate, retry_rate, user_apply_rate.

---

## High-priority fixes first

- P0: Structured output + Zod validation + 422 errors.
- P1: OpenAPI parity + generated client usage.
- P2: Mode-specific UI inputs and explicit apply actions.
- P3: Better template-aware prompts and quality metrics loop.
