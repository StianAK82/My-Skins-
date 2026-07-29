// Simple translation system for the whole page.
// Language is auto-detected from the browser (navigator.language) with a
// manual picker fallback; the choice is remembered in localStorage.
// To add a language: add its code to LANGS and a full Dict below.

export type Lang = "no" | "en";

export const LANGS: Array<{ code: Lang; flag: string; label: string }> = [
  { code: "no", flag: "🇳🇴", label: "Norsk" },
  { code: "en", flag: "🇬🇧", label: "English" },
];

const LANG_KEY = "mySkins.lang";

export function detectLang(): Lang {
  try {
    const stored = window.localStorage.getItem(LANG_KEY);
    if (stored && LANGS.some((l) => l.code === stored)) return stored as Lang;
  } catch {
    /* storage unavailable */
  }
  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("no") || nav.startsWith("nb") || nav.startsWith("nn")) return "no";
  return LANGS.some((l) => nav.startsWith(l.code)) ? (nav.slice(0, 2) as Lang) : "en";
}

export function saveLang(lang: Lang) {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage unavailable */
  }
}

export type Dict = {
  tagline: string;
  ideas: Array<{ emoji: string; label: string; prompt: string }>;
  // Kid-friendly names for outfit values (tops, accessories, hair styles …).
  itemNames: Record<string, string>;
  slotNames: Record<string, string>;
  // Labels used in the direct-upload status ("overdelen", "buksa" …).
  garmentLabels: { shirt: string; pants: string; tshirt: string };
  uploadDoneMsg: string;
  directDone: (items: string) => string;
  sentDirectPrefix: (items: string) => string;
  directFailed: (failed: string) => string;
  robloxLoginAborted: string;
  paymentApprovedSending: string;
  paidCreditsPrefix: string;
  paidNoDownloadHint: string;
  paidButConsumeFailed: string;
  paidNoPending: string;
  paymentNotCompleted: string;
  paymentVerifyFailed: string;
  phaseCreating: string;
  phaseDrawing: string;
  phaseRevising: string;
  phaseDrawingNew: string;
  errMotif: string;
  errBusy: string;
  errGeneric: string;
  errReviseTopDraw: string;
  errReviseGeneric: string;
  // Diff / item-list strings.
  fieldTop: string;
  fieldBottom: string;
  fieldShoes: string;
  fieldHair: string;
  newColor: string;
  removed: (x: string) => string;
  added: (x: string) => string;
  itemNewColor: (x: string) => string;
  itemUpdated: (x: string) => string;
  conflict: (kind: string, slot: string) => string;
  changedNow: string;
  goesIntoRoblox: string;
  goesIntoRobloxHint: string;
  previewOnlyTitle: string;
  previewOnlyHint: string;
  unsupportedTitle: string;
  loadingDefault: string;
  loadingWait: string;
  working: string;
  sendToRoblox: string;
  loggedInAsPrefix: string;
  loggedInAsSuffix: string;
  logout: string;
  loginWithRoblox: string;
  creditsLeft: (n: number) => string;
  priceInfo: string;
  redownload: string;
  tapHint: string;
  reviseTitle: string;
  revisePlaceholder: string;
  reviseButton: string;
  undoButton: string;
  customSummary: string;
  customPlaceholder: string;
  createButton: string;
  sendingDirect: string;
  sendingToPayment: string;
  cantStartPayment: string;
  genericFail: string;
};

const no: Dict = {
  tagline: "👇 Trykk på et bilde – så lager vi skinnet! ✨",
  ideas: [
    { emoji: "🐉", label: "Drage", prompt: "en kul grønn drage som puster oransje ild" },
    { emoji: "🥷", label: "Ninja", prompt: "en tøff svart ninja med rødt pannebånd og sverd" },
    { emoji: "👸", label: "Prinsesse", prompt: "en vakker prinsessekjole i rosa og gull med glitter og krone" },
    { emoji: "🦄", label: "Enhjørning", prompt: "en søt regnbue-enhjørning med stjerner og glitter" },
    { emoji: "⚽", label: "Fotball", prompt: "en kul fotballdrakt med fotball på brystet og striper" },
    { emoji: "🧟", label: "Zombie", prompt: "en skummel grønn zombie med revet t-skjorte" },
    { emoji: "🦸", label: "Superhelt", prompt: "en superheltdrakt i rødt og blått med lyn på brystet" },
    { emoji: "🐱", label: "Kattepus", prompt: "en søt katt med rosa sløyfe og poter" },
    { emoji: "🚀", label: "Astronaut", prompt: "en kul astronautdrakt med rakett og stjerner" },
    { emoji: "🦈", label: "Hai", prompt: "en tøff blå hai med skarpe tenner" },
    { emoji: "🌋", label: "Lava", prompt: "svart drakt med glødende oransje lava og flammer" },
    { emoji: "🎮", label: "Gamer", prompt: "en kul gamer-hettegenser med spillkontroll og neonlys" },
  ],
  itemNames: {
    hoodie: "hettegenser", sweater: "genser", tshirt: "t-skjorte", jacket: "jakke", dress: "kjole",
    pants: "bukse", shorts: "shorts", skirt: "skjørt", sneakers: "joggesko", boots: "støvler",
    cap: "caps", beanie: "lue", hat: "hatt", helmet: "hjelm", crown: "krone", glasses: "briller",
    mask: "maske", unicorn_horn: "enhjørning-hette", dragon_hood: "drage-hette",
    wings: "vinger", backpack: "ryggsekk", bag: "veske", necklace: "kjede",
    scarf: "skjerf", horns: "horn", tail: "hale", belt: "belte", gloves: "hansker",
    jetpack: "jetpack", sword: "sverd", shoulder_guards: "skulderplater", shoulder_pet: "skuldervenn",
    aura: "lysring", flame_aura: "ildring", pixel_aura: "pikselgnister", wavy: "bølgete",
    short: "kort", long: "langt", ponytail: "hestehale", twintails: "to haler", spiky: "piggete",
    curly: "krøllete", braids: "fletter", none: "ingen",
  },
  slotNames: { hat: "hode", back: "rygg", neck: "hals", leftShoulder: "venstre skulder", rightShoulder: "høyre skulder", aura: "aura" },
  garmentLabels: { shirt: "overdelen", pants: "buksa", tshirt: "t-skjorta" },
  uploadDoneMsg:
    "Antrekket er lastet ned som tre filer: overdel (Shirt), bukse (Pants) og t-skjorte-motiv. Roblox sin side er åpnet – last opp overdelen som «Shirt», buksa som «Pants» og motivet som «T-Shirt».",
  directDone: (items) => `🎉 Ferdig! Antrekket (${items}) er sendt rett til Roblox-kontoen din. Husk: Roblox tar 10 Robux per plagg.`,
  sentDirectPrefix: (items) => `Sendt direkte: ${items}. `,
  directFailed: (failed) => `Roblox godtok ikke direkte opplasting av ${failed} (dette kan kreve ID-verifisert konto og minst 10 Robux). `,
  robloxLoginAborted: "Roblox-innloggingen ble avbrutt. Prøv igjen, eller last ned filene manuelt.",
  paymentApprovedSending: "Betaling godkjent! Sender antrekket til Roblox…",
  paidCreditsPrefix: "Betaling godkjent – du har fått 3 opplastinger!",
  paidNoDownloadHint: "Startet ikke nedlastingen? Bruk knappen «Last ned filene på nytt» under.",
  paidButConsumeFailed: "Betaling godkjent, men opplastingen kunne ikke brukes. Trykk «Send til Roblox» igjen.",
  paidNoPending: "Betaling godkjent – du har fått 3 opplastinger! Lag skinnet på nytt og trykk «Send til Roblox».",
  paymentNotCompleted: "Betalingen ble ikke fullført. Prøv igjen.",
  paymentVerifyFailed: "Kunne ikke bekrefte betalingen. Prøv igjen.",
  phaseCreating: "Lager designet…",
  phaseDrawing: "Tegner klærne du beskrev… (kan ta opptil ett minutt)",
  phaseRevising: "Endrer skinnet…",
  phaseDrawingNew: "Tegner de nye klærne… (kan ta opptil ett minutt)",
  errMotif: "Designet er klart, men selve motivet kunne ikke tegnes. Prøv «Lag skin» igjen.",
  errBusy: "AI-en er opptatt eller grensen er nådd. Prøv igjen om litt.",
  errGeneric: "Noe gikk galt med AI-en. Prøv igjen, gjerne med en litt annen beskrivelse.",
  errReviseTopDraw: "Endringen er lagret, men den nye overdelen kunne ikke tegnes. Prøv igjen.",
  errReviseGeneric: "Endringen gikk ikke gjennom. Prøv igjen, gjerne med litt andre ord.",
  fieldTop: "Overdel",
  fieldBottom: "Underdel",
  fieldShoes: "Sko",
  fieldHair: "Hår",
  newColor: "ny farge",
  removed: (x) => `Fjernet: ${x}`,
  added: (x) => `Ny: ${x}`,
  itemNewColor: (x) => `${x}: ny farge`,
  itemUpdated: (x) => `${x}: oppdatert`,
  conflict: (kind, slot) => `${kind} (kun plass til én ting i ${slot}-sporet)`,
  changedNow: "🔁 Endret nå",
  goesIntoRoblox: "Blir med inn i Roblox 🎮",
  goesIntoRobloxHint: "Klær (gensere, bukser, kjoler …) kan lastes opp, det bestemmer Roblox.",
  previewOnlyTitle: "Ser du bare her 👀",
  previewOnlyHint: "Roblox lar oss ikke laste opp slike 3D-deler ennå – men de vises på figuren din her!",
  unsupportedTitle: "⚠️ Ikke støttet",
  loadingDefault: "Lager skinnet ditt…",
  loadingWait: "Vent litt – se på figuren! 👀",
  working: "Jobber…",
  sendToRoblox: "🎁 Send til Roblox!",
  loggedInAsPrefix: "🎮 Logget inn som",
  loggedInAsSuffix: "– antrekket sendes rett til kontoen din!",
  logout: "Logg ut",
  loginWithRoblox: "🎮 Logg inn med Roblox (send skins rett til kontoen din)",
  creditsLeft: (n) => `⭐ ${n} opplastinger igjen`,
  priceInfo: "10 kr gir 3 opplastinger (en voksen hjelper med betalingen)",
  redownload: "📥 Last ned filene på nytt (gratis – du har allerede betalt)",
  tapHint: "Trykk på et bilde øverst for å lage skinnet ditt! 👆",
  reviseTitle: "🪄 Vil du endre noe? Skriv det her – resten beholdes!",
  revisePlaceholder: "F.eks. «gjør vingene større» eller «bare capsen blå»",
  reviseButton: "Endre",
  undoButton: "↩️ Angre siste endring",
  customSummary: "✏️ Skriv ditt eget skin (for store barn og voksne)",
  customPlaceholder: "F.eks. «svart drage-hettegenser med røde flammer»",
  createButton: "Lag skin",
  sendingDirect: "Sender antrekket rett til Roblox-kontoen din…",
  sendingToPayment: "Sender deg til betaling (10 kr for 3 opplastinger)…",
  cantStartPayment: "Kunne ikke starte betaling. Prøv igjen.",
  genericFail: "Noe gikk galt. Prøv igjen.",
};

const en: Dict = {
  tagline: "👇 Tap a picture – and we'll make your skin! ✨",
  ideas: [
    { emoji: "🐉", label: "Dragon", prompt: "a cool green dragon breathing orange fire" },
    { emoji: "🥷", label: "Ninja", prompt: "a tough black ninja with a red headband and sword" },
    { emoji: "👸", label: "Princess", prompt: "a beautiful princess dress in pink and gold with glitter and a crown" },
    { emoji: "🦄", label: "Unicorn", prompt: "a cute rainbow unicorn with stars and glitter" },
    { emoji: "⚽", label: "Soccer", prompt: "a cool soccer kit with a football on the chest and stripes" },
    { emoji: "🧟", label: "Zombie", prompt: "a scary green zombie with a torn t-shirt" },
    { emoji: "🦸", label: "Superhero", prompt: "a superhero suit in red and blue with a lightning bolt on the chest" },
    { emoji: "🐱", label: "Kitty", prompt: "a cute cat with a pink bow and paws" },
    { emoji: "🚀", label: "Astronaut", prompt: "a cool astronaut suit with a rocket and stars" },
    { emoji: "🦈", label: "Shark", prompt: "a tough blue shark with sharp teeth" },
    { emoji: "🌋", label: "Lava", prompt: "a black outfit with glowing orange lava and flames" },
    { emoji: "🎮", label: "Gamer", prompt: "a cool gamer hoodie with a game controller and neon lights" },
  ],
  itemNames: {
    hoodie: "hoodie", sweater: "sweater", tshirt: "t-shirt", jacket: "jacket", dress: "dress",
    pants: "pants", shorts: "shorts", skirt: "skirt", sneakers: "sneakers", boots: "boots",
    cap: "cap", beanie: "beanie", hat: "hat", helmet: "helmet", crown: "crown", glasses: "glasses",
    mask: "mask", unicorn_horn: "unicorn hood", dragon_hood: "dragon hood",
    wings: "wings", backpack: "backpack", bag: "bag", necklace: "necklace",
    scarf: "scarf", horns: "horns", tail: "tail", belt: "belt", gloves: "gloves",
    jetpack: "jetpack", sword: "sword", shoulder_guards: "shoulder guards", shoulder_pet: "shoulder buddy",
    aura: "light ring", flame_aura: "flame ring", pixel_aura: "pixel sparks", wavy: "wavy",
    short: "short", long: "long", ponytail: "ponytail", twintails: "twin tails", spiky: "spiky",
    curly: "curly", braids: "braids", none: "none",
  },
  slotNames: { hat: "head", back: "back", neck: "neck", leftShoulder: "left shoulder", rightShoulder: "right shoulder", aura: "aura" },
  garmentLabels: { shirt: "the top", pants: "the pants", tshirt: "the t-shirt" },
  uploadDoneMsg:
    "Your outfit was downloaded as three files: top (Shirt), pants (Pants) and t-shirt design. The Roblox page is open – upload the top as “Shirt”, the pants as “Pants” and the design as “T-Shirt”.",
  directDone: (items) => `🎉 Done! Your outfit (${items}) was sent straight to your Roblox account. Remember: Roblox charges 10 Robux per item.`,
  sentDirectPrefix: (items) => `Sent directly: ${items}. `,
  directFailed: (failed) => `Roblox didn't accept direct upload of ${failed} (this may require an ID-verified account and at least 10 Robux). `,
  robloxLoginAborted: "The Roblox login was cancelled. Try again, or download the files manually.",
  paymentApprovedSending: "Payment approved! Sending your outfit to Roblox…",
  paidCreditsPrefix: "Payment approved – you got 3 uploads!",
  paidNoDownloadHint: "Download didn't start? Use the “Download the files again” button below.",
  paidButConsumeFailed: "Payment approved, but the upload couldn't be used. Press “Send to Roblox” again.",
  paidNoPending: "Payment approved – you got 3 uploads! Make your skin again and press “Send to Roblox”.",
  paymentNotCompleted: "The payment wasn't completed. Please try again.",
  paymentVerifyFailed: "Couldn't confirm the payment. Please try again.",
  phaseCreating: "Creating your design…",
  phaseDrawing: "Drawing the clothes you described… (can take up to a minute)",
  phaseRevising: "Changing your skin…",
  phaseDrawingNew: "Drawing the new clothes… (can take up to a minute)",
  errMotif: "The design is ready, but the picture couldn't be drawn. Try “Make skin” again.",
  errBusy: "The AI is busy or the limit was reached. Try again in a bit.",
  errGeneric: "Something went wrong with the AI. Try again, maybe with a slightly different description.",
  errReviseTopDraw: "The change was saved, but the new top couldn't be drawn. Try again.",
  errReviseGeneric: "The change didn't go through. Try again, maybe with different words.",
  fieldTop: "Top",
  fieldBottom: "Bottom",
  fieldShoes: "Shoes",
  fieldHair: "Hair",
  newColor: "new color",
  removed: (x) => `Removed: ${x}`,
  added: (x) => `New: ${x}`,
  itemNewColor: (x) => `${x}: new color`,
  itemUpdated: (x) => `${x}: updated`,
  conflict: (kind, slot) => `${kind} (only room for one thing in the ${slot} slot)`,
  changedNow: "🔁 Just changed",
  goesIntoRoblox: "Goes into Roblox 🎮",
  goesIntoRobloxHint: "Clothes (sweaters, pants, dresses …) can be uploaded – Roblox decides that.",
  previewOnlyTitle: "Only visible here 👀",
  previewOnlyHint: "Roblox doesn't let us upload these 3D parts yet – but they show on your character here!",
  unsupportedTitle: "⚠️ Not supported",
  loadingDefault: "Making your skin…",
  loadingWait: "Hang on – watch your character! 👀",
  working: "Working…",
  sendToRoblox: "🎁 Send to Roblox!",
  loggedInAsPrefix: "🎮 Logged in as",
  loggedInAsSuffix: "– your outfit goes straight to your account!",
  logout: "Log out",
  loginWithRoblox: "🎮 Log in with Roblox (send skins straight to your account)",
  creditsLeft: (n) => `⭐ ${n} uploads left`,
  priceInfo: "10 kr gives 3 uploads (ask a grown-up to help with payment)",
  redownload: "📥 Download the files again (free – you already paid)",
  tapHint: "Tap a picture at the top to make your skin! 👆",
  reviseTitle: "🪄 Want to change something? Write it here – the rest stays!",
  revisePlaceholder: "E.g. “make the wings bigger” or “only the cap blue”",
  reviseButton: "Change",
  undoButton: "↩️ Undo last change",
  customSummary: "✏️ Write your own skin (for big kids and grown-ups)",
  customPlaceholder: "E.g. “black dragon hoodie with red flames”",
  createButton: "Make skin",
  sendingDirect: "Sending your outfit straight to your Roblox account…",
  sendingToPayment: "Taking you to payment (10 kr for 3 uploads)…",
  cantStartPayment: "Couldn't start payment. Please try again.",
  genericFail: "Something went wrong. Please try again.",
};

const DICTS: Record<Lang, Dict> = { no, en };

export function getDict(lang: Lang): Dict {
  return DICTS[lang] ?? DICTS.no;
}
