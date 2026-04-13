# My Skins — 4-ukers gjennomføringsplan basert på totalanalyse

Dato: 2026-04-13  
Eiere: Produktleder + teknisk leder  
Kildegrunnlag: `docs/TOTALANALYSE_APP_VS_CONSUMERUSE_2026-04-13.md`, relevante audit-/paritetsdokumenter og eksisterende kodebase

## 1. Formål

Dette dokumentet oversetter totalanalysen fra vurdering til gjennomføring.

Det skal brukes som arbeidsplan for de neste 4 ukene, med tydelig rekkefølge, konkrete leveranser, avgrensninger og ferdigkriterier per uke. Målet er å redusere produktgapet på de områdene som i dag skaper lavest tillit hos brukeren: AI-kvalitet, editor-presisjon og publiseringsforutsigbarhet.

**Bruk i praksis:**
- Planlegg sprintmål og backlog direkte fra denne planen.
- Bruk akseptansekriterier som “definition of done”.
- Avvis arbeid som ikke støtter fokusområdene eller som bryter non-goals.

---

## 2. Utgangspunkt (nå-situasjon)

### Dette gjør My Skins bra allerede
- Tydelig appstruktur med gode flyter for landing, dashboard, prosjekter og editor.
- Solid API-grunnmur med god validering i sentrale AI v2-deler.
- Bra teknisk fundament i editorens state/render-pipeline.
- God produktinnramming og tydelig “creator”-retning.

### Dette hindrer “best in class”-opplevelse nå
- For svak synlighet på AI-kvalitet: bruker kan oppleve “suksess” uten høy output-integritet.
- Editor mangler flere presisjonsverktøy som forventes i effektiv produksjon.
- Publish/upload-opplevelsen er ikke trygg nok end-to-end i produktfølelse.
- Gap mellom løfte i UX/landing og faktisk robusthet i kjerneloopen.

### Modenhetsnivå
My Skins vurderes fortsatt som **sterk prototype / tidlig MVP** (ikke beta-klar som helhet).

---

## 3. Strategisk fokus for neste 4 uker

Vi prioriterer tre fokusområder, i denne rekkefølgen:

1. **AI-tillit og kvalitetskonfidens**
   - Gjør kvalitet eksplisitt i API + UI.
   - Fjern “falsk grønn” ved delvis/feilet generering.

2. **Editor-presisjon og produksjonskraft**
   - Løft fra funksjonell editor til effektiv arbeidsflate med konkrete pro-verktøy.

3. **Publiseringskonfidens**
   - Gjør publish/upload-status, feilårsaker og retry håndterbare for bruker.

**Prioriteringsregel:** Vi starter ikke større utvidelser før punkt 1 har målbar effekt i brukeropplevelsen.

---

## 4. Eksplisitte non-goals (ikke nå)

Følgende er bevisst utsatt i denne 4-ukersperioden:

- App Store/mobile-pakketering.
- Stripe-utvidelser utover nødvendig stabilitet i eksisterende flyt.
- Bred plattformutvidelse utover Roblox-kjerneløp.
- Store visuelle redesign-initiativ uten direkte effekt på AI/editor/publish-kjerne.
- Store arkitektur- eller rammeverksrewrites.
- Ny “feature wishlist” som ikke styrker kjerneflyten idé → design → preview → publish.

---

## 5. Sprint-/ukenedbrytning (4 uker)

## Anbefalt gjennomføringsrekkefølge
1) Stabiliser AI-kvalitetskontrakt og synlighet.  
2) Forsterk editorens presisjon og kontroll.  
3) Hardn publish/upload med status og feilhåndtering.  
4) Lås kvalitet med test/regresjon og release-sjekk.

### Uke 1 — AI-kvalitet gjort synlig og ærlig

**Mål**  
Eliminere uklarhet om AI-resultatets kvalitetstilstand.

**Hvorfor dette er viktig**  
Lav tillit i første resultat undergraver hele produktet, uansett hvor god editoren er.

**Nøkkelleveranser**
- Innføre eksplisitt genereringsstatus (`complete | partial | failed`) i AI-respons der relevant.
- Per-region diagnostikk for hva som faktisk ble generert.
- UI-markering i editor/AI-panel som skiller “ekte AI-resultat” fra fallback/ufullstendig.
- Klargjort feiltekst for bruker (ikke bare “failed”).

**Sannsynlig berørte systemer/filer**
- API-ruter og AI-kontrakter: `artifacts/api-server/src/routes/ai.ts`, `artifacts/api-server/src/lib/ai-contracts.ts`, `lib/api-spec/openapi.yaml`, `lib/api-zod/src/generated/*`.
- Frontend AI-flyt: `artifacts/my-skins/src/components/editor/AiPanel.tsx`, `artifacts/my-skins/src/pages/Editor.tsx`, `artifacts/my-skins/src/lib/ai/*`.

**Akseptansekriterier**
- Ingen AI-kall presenteres som full suksess hvis kritiske region-assets mangler.
- Bruker kan se kvalitetstilstand uten å tolke rådata.
- Delvis/feilet tilfelle har tydelig og handlingsrettet neste steg (retry/endre prompt/manuell justering).

**Risiko/avhengigheter**
- Avhengig av kontraktsoppdatering mellom backend og frontend.
- Risiko for klientbrudd hvis schema-endringer ikke rulles koordinert.

---

### Uke 2 — Editor-presisjon som faktisk øker produksjonstempo

**Mål**  
Introdusere minimum sett av pro-verktøy som reduserer friksjon i manuell finjustering.

**Hvorfor dette er viktig**  
Når AI ikke leverer perfekt, må editoren kompensere raskt og presist.

**Nøkkelleveranser**
- Snapping og alignment guides for plassering.
- Forbedret lagkontroll: synlighet, lås, tydeligere reorder-flyt.
- Enkle zone constraints/presets per plaggtype for tryggere plassering.

**Sannsynlig berørte systemer/filer**
- Editor-kjerne: `artifacts/my-skins/src/pages/Editor.tsx`, `artifacts/my-skins/src/lib/editor/design-state.ts`, `artifacts/my-skins/src/lib/editor/renderer.ts`, `artifacts/my-skins/src/lib/editor/assets.ts`, `artifacts/my-skins/src/lib/editor/templates.ts`.
- UI-komponenter i editorflate/lister: `artifacts/my-skins/src/components/editor/*`.

**Akseptansekriterier**
- Bruker kan justere lag med synlig presisjonsstøtte (snap/guide).
- Lag kan skjules/låses uten sideeffekter på eksport.
- Objektplassering utenfor tillatte soner håndteres forutsigbart.

**Risiko/avhengigheter**
- Risiko for regressjoner i eksisterende Fabric-håndtering.
- Krever avklaring av “minimum viable” zone-regler for uke 2 (ikke full regelmotor).

---

### Uke 3 — Publish/upload med tydelig status og recovery

**Mål**  
Gjøre publish-løpet forutsigbart for bruker, med klar jobstatus og feilhåndtering.

**Hvorfor dette er viktig**  
“Verdien” realiseres først når design faktisk kan publiseres med høy trygghet.

**Nøkkelleveranser**
- Tydelig end-to-end statusvisning i UI for upload-jobb.
- Retry-støtte for håndterbare feiltilfeller.
- Forbedret feilklassifisering (brukerfeil, integrasjonsfeil, midlertidig feil).

**Sannsynlig berørte systemer/filer**
- Backend publish/integrasjon: `artifacts/api-server/src/routes/roblox.ts`, relevante services og DB-tabeller for upload-events/jobs i `lib/db/src/schema/roblox_upload_jobs.ts` og `lib/db/src/schema/roblox_upload_events.ts`.
- Frontend publish-klient/visning: `artifacts/my-skins/src/lib/roblox/upload-client.ts`, editor-/prosjektflater som viser status.

**Akseptansekriterier**
- Bruker ser alltid aktuell publish-status (ikke “stille” feil).
- Retry er tilgjengelig for midlertidige feil uten å starte fra null.
- Feilmeldinger peker på konkret handling (koble konto på nytt, prøv igjen senere, etc.).

**Risiko/avhengigheter**
- Avhengig av nåværende integrasjonsmodenhet og eventmodell.
- Risiko for å bygge UI over delvis simulert backend; må merkes tydelig hvis ekte end-to-end ikke er fullført.

---

### Uke 4 — Hardening, måling og release-sikkerhet

**Mål**  
Sikre at forbedringene faktisk holder i drift, og at teamet kan slippe med kontroll.

**Hvorfor dette er viktig**  
Uten regressjonssikring vil uke 1–3 forvitre raskt.

**Nøkkelleveranser**
- Testforsterkning rundt AI-kontrakter, editor-kjerne og publish-statusløp.
- Enkel pre-release sjekkliste for kjerneflow (idé → editor → preview → publish).
- Instrumentering/logging for sentrale feiltilstander i ny flyt.
- Beslutningsnotat: “klar for beta-kandidat?” med eksplisitte ja/nei-punkter.

**Sannsynlig berørte systemer/filer**
- Tester i API/editor: f.eks. `artifacts/api-server/src/lib/*.test.ts`, `artifacts/my-skins/src/lib/editor/*.test.ts`.
- Logger/observability: `artifacts/api-server/src/lib/logger.ts` og berørte ruter.
- Dokumentasjon/runbooks: `docs/*`.

**Akseptansekriterier**
- Kritiske scenarier dekkes av automatiserte tester eller verifiserbar sjekkliste.
- Nye kvalitetsstatusfelt er konsistente gjennom API, UI og logging.
- Teamet har en eksplisitt release-anbefaling basert på målte kriterier, ikke magefølelse.

**Risiko/avhengigheter**
- Risiko for at hardening presses ut av tidsplanen; må beskyttes som leveranse, ikke “nice to have”.

---

## 6. Domenekartlegging mot scorecard fra totalanalysen

| Domene fra totalanalyse | Nå-bilde | Primære sprintbidrag | Forventet effekt etter 4 uker |
|---|---|---|---|
| AI reliability | Lav-middels tillit | Uke 1 + Uke 4 | Tydelig kvalitetstilstand, færre falske suksesser |
| Editor power | Funksjonell men ikke pro | Uke 2 + Uke 4 | Raskere og mer presis manuell forbedring |
| Preview realisme/verdi | Middels nytte | Uke 2 (zone/presisjon) + Uke 4 (kjerneflow-testing) | Høyere valideringsverdi i designløp |
| Platform integration readiness | MVP-nivå | Uke 3 + Uke 4 | Mer forutsigbart publish-løp med recovery |
| Total produktmodenhet | Sterk prototype/tidlig MVP | Alle uker i sekvens | Realistisk løft mot mer robust beta-kandidat |

---

## 7. Suksesskriterier etter 4 uker

Planen regnes som gjennomført når følgende er sant:

1. **AI-kvalitet er eksplisitt synlig** i både API-respons og editor-UX, og delvis/feilet output kan ikke misforstås som full suksess.
2. **Editoren gir målbar presisjonsgevinst** (snap/guides + bedre lagkontroll + grunnleggende zone-sikkerhet).
3. **Publish/upload-løpet har tydelig statusmodell** med brukerforståelige feil og retry for midlertidige feil.
4. **Kritiske flyter er regresjonssikret** gjennom test/sjekkliste før release-beslutning.
5. **Prioritering er holdt stram**: ingen større sideprosjekter har fortrengt kjerneforbedringene.

---

## 8. Åpne spørsmål / oppfølging etter 4-ukersplan

Disse temaene er viktige, men håndteres etter denne perioden:

- Dypere 3D/preview-realisme utover nødvendig valideringsnivå.
- Full kommersiell utvidelse i billing/planer/entitlements.
- Bredere asset-/module marketplace og avanserte pakkesystemer.
- Eventuell utvidelse til nye plattformer utenfor Roblox-kjernen.
- Større informasjonsarkitektur- og UI-fornyelse.

**Største feilmode hvis vi gjør dette feil:**  
Vi leverer mange nye features, men uten tydelig AI-kvalitet og publish-trygghet. Da øker kompleksiteten, mens brukerens tillit fortsatt står stille.

---

## Praktisk styring av gjennomføring (for team + Codex-prompter)

For å holde planen operativ bør alle nye oppgaver/propmter kobles til:
1) hvilken uke/sprint de støtter,  
2) hvilke akseptansekriterier de påvirker,  
3) hva som er bevis for ferdigstillelse.

Hvis en oppgave ikke kan knyttes til ett av de tre fokusområdene i denne planen, skal den som hovedregel utsettes.
