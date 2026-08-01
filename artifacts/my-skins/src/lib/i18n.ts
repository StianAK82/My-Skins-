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
  errTooLong: string;
  errPii: string;
  errBlocked: string;
  errIp: string;
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
  headcoverChoiceTitle: string;
  headcoverNone: string;
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
  // 2D/3D delivery choice + parent guide for the 3D route.
  glbButton: string;
  glbHint: string;
  glbWorking: string;
  glbFailed: string;
  guideTitle: string;
  guideIntro: string;
  guideSteps: string[];
  guideNote: string;
  guideClose: string;
  guideDownloadAgain: string;
};

const no: Dict = {
  tagline: "Trykk på et bilde – så lager vi skinnet!",
  ideas: [
    { emoji: "🐉", label: "Drage", prompt: "en kul grønn drage som puster oransje ild" },
    { emoji: "🥷", label: "Ninja", prompt: "en tøff svart ninja med rødt pannebånd og sverd" },
    { emoji: "👸", label: "Prinsesse", prompt: "en vakker prinsessekjole i rosa og gull med glitter og krone" },
    { emoji: "🦄", label: "Enhjørning", prompt: "en søt regnbue-enhjørning med stjerner og glitter" },
    { emoji: "⚽", label: "Fotball", prompt: "en kul fotballdrakt med fotball på brystet og striper" },
    { emoji: "🧟", label: "Zombie", prompt: "en skummel grønn zombie med revet t-skjorte" },
    { emoji: "🦸", label: "Superhelt", prompt: "en superheltdrakt i rødt og blått med lyn på brystet" },
    { emoji: "🐱", label: "Kattepus", prompt: "en søt katt med rosa sløyfe og poter" },
    { emoji: "🚀", label: "Astronaut", prompt: "en hvit NASA-astronautdrakt med hjelm, ryggsekk, rakett og stjerner" },
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
  errTooLong: "Oi, teksten ble litt for lang! Prøv å beskrive skinet ditt med færre ord. 😊",
  errPii: "Ikke skriv navn, adresse eller telefonnummer her. Beskriv bare skinet du ønsker deg! 😊",
  errBlocked: "Det der kan vi ikke lage. Prøv en annen idé – kanskje en kul drage eller en romhelt? 🐉",
  errIp: "Vi kan ikke kopiere ekte merker og logoer, men vi kan lage din helt egen kule variant! Prøv å beskrive stilen i stedet.",
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
  headcoverChoiceTitle: "Velg hva som vises på hodet 🎩",
  headcoverNone: "Ingen",
  unsupportedTitle: "⚠️ Ikke støttet",
  loadingDefault: "Lager skinnet ditt…",
  loadingWait: "Vent litt – se på figuren! 👀",
  working: "Jobber…",
  sendToRoblox: "Send til Roblox!",
  loggedInAsPrefix: "🎮 Logget inn som",
  loggedInAsSuffix: "– antrekket sendes rett til kontoen din!",
  logout: "Logg ut",
  loginWithRoblox: "Logg inn med Roblox (send skins rett til kontoen din)",
  creditsLeft: (n) => `⭐ ${n} opplastinger igjen`,
  priceInfo: "10 kr gir 3 opplastinger (en voksen hjelper med betalingen)",
  redownload: "📥 Last ned filene på nytt (gratis – du har allerede betalt)",
  tapHint: "Trykk på et bilde øverst for å lage skinnet ditt!",
  reviseTitle: "🪄 Vil du endre noe? Skriv det her – resten beholdes!",
  revisePlaceholder: "F.eks. «gjør vingene større» eller «bare capsen blå»",
  reviseButton: "Endre",
  undoButton: "↩️ Angre siste endring",
  customSummary: "Skriv ditt eget skin (for store barn og voksne)",
  customPlaceholder: "F.eks. «svart drage-hettegenser med røde flammer»",
  createButton: "Lag skin",
  sendingDirect: "Sender antrekket rett til Roblox-kontoen din…",
  sendingToPayment: "Sender deg til betaling (10 kr for 3 opplastinger)…",
  cantStartPayment: "Kunne ikke starte betaling. Prøv igjen.",
  genericFail: "Noe gikk galt. Prøv igjen.",
  glbButton: "Last ned som 3D-fil (gratis)",
  glbHint: "3D-forhåndsvisning for foreldre med Roblox Studio – ikke kontrollert for Roblox-opplasting ennå",
  glbWorking: "Lager 3D-filen…",
  glbFailed: "Kunne ikke lage 3D-filen. Prøv igjen (3D-visningen må være synlig).",
  guideTitle: "🧊 Slik bruker du 3D-filen (for en voksen)",
  guideIntro: "3D-filen (.glb) inneholder hele figuren med antrekket – akkurat slik den ser ut her. For å få den inn i Roblox trengs Roblox Studio på en PC/Mac. Slik gjør dere det:",
  guideSteps: [
    "Last ned og installer Roblox Studio gratis fra create.roblox.com (logg inn med barnets konto eller din egen).",
    "Åpne Roblox Studio og lag et nytt prosjekt (velg «Baseplate»).",
    "Dra 3D-filen (my-skin-3d.glb) rett inn i 3D-vinduet i Studio – figuren dukker opp som en modell.",
    "Vil dere at figuren skal kunne BRUKES som avatar-klær, må plagget gjøres om til «layered clothing» med Roblox sitt Avatar Setup-verktøy i Studio (fanen «Avatar» → «Avatar Setup»). Dette er det avanserte steget – Roblox har egne videoguider for det.",
    "For å SELGE/publisere 3D-plagg på Roblox krever Roblox: ID-verifisering eller foreldrekobling på kontoen, Roblox Plus/Premium-abonnement, 80 Robux i opplastingsavgift og et publiseringsforskudd. Dette er Roblox sine regler og gjelder alle.",
  ],
  guideNote: "Tips: 2D-knappen («Send til Roblox») er fortsatt den enkleste veien – den fungerer uten Studio. 3D-filen kan også åpnes i gratisprogrammer som Blender, eller bare vises frem 😊",
  guideClose: "Lukk",
  guideDownloadAgain: "📥 Last ned 3D-filen på nytt",
};

const en: Dict = {
  tagline: "Tap a picture – and we'll make your skin!",
  ideas: [
    { emoji: "🐉", label: "Dragon", prompt: "a cool green dragon breathing orange fire" },
    { emoji: "🥷", label: "Ninja", prompt: "a tough black ninja with a red headband and sword" },
    { emoji: "👸", label: "Princess", prompt: "a beautiful princess dress in pink and gold with glitter and a crown" },
    { emoji: "🦄", label: "Unicorn", prompt: "a cute rainbow unicorn with stars and glitter" },
    { emoji: "⚽", label: "Soccer", prompt: "a cool soccer kit with a football on the chest and stripes" },
    { emoji: "🧟", label: "Zombie", prompt: "a scary green zombie with a torn t-shirt" },
    { emoji: "🦸", label: "Superhero", prompt: "a superhero suit in red and blue with a lightning bolt on the chest" },
    { emoji: "🐱", label: "Kitty", prompt: "a cute cat with a pink bow and paws" },
    { emoji: "🚀", label: "Astronaut", prompt: "a white NASA astronaut suit with helmet, backpack, rocket and stars" },
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
  errTooLong: "Oops, that text got a bit long! Try describing your skin with fewer words. 😊",
  errPii: "Don't write names, addresses or phone numbers here. Just describe the skin you want! 😊",
  errBlocked: "We can't make that one. Try another idea – maybe a cool dragon or a space hero? 🐉",
  errIp: "We can't copy real brands or logos, but we can make your very own cool version! Try describing the style instead.",
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
  headcoverChoiceTitle: "Pick what shows on the head 🎩",
  headcoverNone: "None",
  unsupportedTitle: "⚠️ Not supported",
  loadingDefault: "Making your skin…",
  loadingWait: "Hang on – watch your character! 👀",
  working: "Working…",
  sendToRoblox: "Send to Roblox!",
  loggedInAsPrefix: "🎮 Logged in as",
  loggedInAsSuffix: "– your outfit goes straight to your account!",
  logout: "Log out",
  loginWithRoblox: "Log in with Roblox (send skins straight to your account)",
  creditsLeft: (n) => `⭐ ${n} uploads left`,
  priceInfo: "10 kr gives 3 uploads (ask a grown-up to help with payment)",
  redownload: "📥 Download the files again (free – you already paid)",
  tapHint: "Tap a picture at the top to make your skin!",
  reviseTitle: "🪄 Want to change something? Write it here – the rest stays!",
  revisePlaceholder: "E.g. “make the wings bigger” or “only the cap blue”",
  reviseButton: "Change",
  undoButton: "↩️ Undo last change",
  customSummary: "Write your own skin (for big kids and grown-ups)",
  customPlaceholder: "E.g. “black dragon hoodie with red flames”",
  createButton: "Make skin",
  sendingDirect: "Sending your outfit straight to your Roblox account…",
  sendingToPayment: "Taking you to payment (10 kr for 3 uploads)…",
  glbButton: "Download as 3D file (free)",
  glbHint: "3D preview download for parents with Roblox Studio – not validated for Roblox upload yet",
  glbWorking: "Creating the 3D file…",
  glbFailed: "Couldn't create the 3D file. Try again (the 3D preview must be visible).",
  guideTitle: "🧊 How to use the 3D file (for an adult)",
  guideIntro: "The 3D file (.glb) contains the whole avatar with the outfit – exactly as it looks here. To get it into Roblox you need Roblox Studio on a PC/Mac. Here's how:",
  guideSteps: [
    "Download and install Roblox Studio for free from create.roblox.com (sign in with your child's account or your own).",
    "Open Roblox Studio and create a new project (choose “Baseplate”).",
    "Drag the 3D file (my-skin-3d.glb) straight into the 3D viewport in Studio – the avatar appears as a model.",
    "To make the outfit WEARABLE as avatar clothing, the garment must be converted to “layered clothing” with Roblox's Avatar Setup tool in Studio (the “Avatar” tab → “Avatar Setup”). This is the advanced step – Roblox has its own video guides for it.",
    "To SELL/publish 3D items on Roblox, Roblox requires: ID verification or a linked parent account, a Roblox Plus/Premium membership, an 80 Robux upload fee and a publishing advance. These are Roblox's rules and apply to everyone.",
  ],
  guideNote: "Tip: the 2D button (“Send to Roblox”) is still the easiest route – it works without Studio. The 3D file can also be opened in free tools like Blender, or just shown off 😊",
  guideClose: "Close",
  guideDownloadAgain: "📥 Download the 3D file again",
  cantStartPayment: "Couldn't start payment. Please try again.",
  genericFail: "Something went wrong. Please try again.",
};

const DICTS: Record<Lang, Dict> = { no, en };

export function getDict(lang: Lang): Dict {
  return DICTS[lang] ?? DICTS.no;
}
