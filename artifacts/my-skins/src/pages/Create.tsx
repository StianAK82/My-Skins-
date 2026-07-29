import { useCallback, useEffect, useRef, useState } from "react";
import { aiGenerateDesign } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Upload, Loader2, Undo2 } from "lucide-react";
import { AvatarPreview, type GarmentConfig } from "@/components/editor/AvatarPreview";
import { useDesignStore } from "@/lib/editor/design-state";
import { classicTextureAiSchema, parseClassicTextureAiPlan } from "@/lib/editor/ai-schema";
import { preloadOverlayImages, renderDesignToCanvas } from "@/lib/editor/renderer";
import { buildAiAvatarLook } from "@/lib/editor/avatar-look";
import { normalizeAiResponse } from "@/lib/ai/normalize-ai-response";
import {
  parsePendingOutfit,
  pickPantsColors,
  renderPantsTexture,
  renderTShirtTexture,
  type OutfitFiles,
} from "@/lib/editor/outfit";
import { resolveAvatarSlotAssets } from "@/lib/ai/asset-resolver";
import { LANGS, detectLang, getDict, saveLang, type Dict, type Lang } from "@/lib/i18n";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mapAiModuleToLayer(module: {
  id: string;
  type: string;
  label: string;
  color: string;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  opacity: number;
}) {
  const boundedX = clamp(module.position.x, 0, 1);
  const boundedY = clamp(module.position.y, 0, 1);
  const isPattern = module.type.toLowerCase().includes("pattern");
  const isAccessory = module.type.toLowerCase().includes("accessory") || module.type.toLowerCase().includes("hair");
  const isTrim = module.type.toLowerCase().includes("trim");
  const zone = boundedX < 0.18 ? "left_sleeve" : boundedX > 0.82 ? "right_sleeve" : boundedY > 0.72 ? "back" : "front";
  const halfWidth = 64;
  const halfHeight = 64;
  const layerType: "accessoryLayer" | "moduleLayer" = isAccessory ? "accessoryLayer" : "moduleLayer";
  return {
    name: module.label,
    type: layerType,
    zone,
    placementIntent: isPattern ? "allover" : boundedY < 0.3 ? "hero" : "supporting",
    anchor: boundedY < 0.25 ? "top" : boundedY > 0.75 ? "bottom" : "center",
    relativeScale: clamp(module.scale, 0.2, isPattern ? 0.95 : 1.25),
    color: module.color,
    assetId: module.id,
    assetCategory: isPattern ? "pattern" : isAccessory ? "accessory" : isTrim ? "trim" : "module",
    transform: {
      x: clamp((boundedX - 0.5) * halfWidth * 2, -halfWidth, halfWidth),
      y: clamp((boundedY - 0.5) * halfHeight * 2, -halfHeight, halfHeight),
      scale: clamp(module.scale, 0.2, 1.6),
      rotation: clamp(module.rotation, -180, 180),
      opacity: clamp(module.opacity, 0.2, 1),
    },
  };
}

function downloadPng(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

// Big tap-to-create ideas so even small kids (who can't read yet) can use the app.
// Emojis/prompts live in the translation dictionaries (see i18n.ts).

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;
const PENDING_SKIN_KEY = "mySkins.pendingSkin";

type SkinStatus = { remainingFree: number; freeLimit: number; paidCredits: number };

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`GET ${path} ${res.status}`);
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

function openRobloxWithFiles(files: OutfitFiles) {
  const downloads: Array<[string, string | undefined]> = [
    ["roblox-overdel-shirt.png", files.shirt],
    ["roblox-bukse-pants.png", files.pants],
    ["roblox-tskjorte-motiv.png", files.tshirt],
  ];
  // Open Roblox synchronously (before timers) so popup blockers don't eat it,
  // then stagger the downloads slightly so the browser accepts all of them.
  window.open("https://create.roblox.com/dashboard/creations", "_blank", "noopener");
  let delay = 0;
  for (const [name, url] of downloads) {
    if (!url) continue;
    window.setTimeout(() => downloadPng(url, name), delay);
    delay += 400;
  }
}

type RobloxMe = { loggedIn: boolean; configured?: boolean; name?: string; picture?: string };

const DIRECT_ITEMS: Array<{ key: keyof OutfitFiles; type: "shirt" | "pants" | "tshirt"; name: string }> = [
  { key: "shirt", type: "shirt", name: "My Skins overdel" },
  { key: "pants", type: "pants", name: "My Skins bukse" },
  { key: "tshirt", type: "tshirt", name: "My Skins t-skjorte" },
];

// The AI's structured outfit plan (subset of the server response we act on).
type OutfitPlan = NonNullable<ReturnType<typeof normalizeAiResponse>["result"]["outfit"]>;

// Everything needed to roll one revision back with the «Angre»-button:
// the full design store state (layers + avatar slots), the 3D garment meshes,
// the outfit plan/prompt the next revision would patch against, the item list
// and the export-texture refs.
type UndoSnapshot = {
  designState: ReturnType<typeof useDesignStore.getState>["state"];
  garmentConfig: GarmentConfig;
  outfit: OutfitPlan;
  prompt: string;
  outfitItems: { uploadable: string[]; previewOnly: string[]; unsupported: string[]; changed?: string[] } | null;
  outfitRefValue: { pantsBase: string; pantsAccent: string; heroUrl?: string; fabricUrl?: string } | null;
};

const UNDO_STACK_LIMIT = 10;

// Sentinel for «Ingen» in the headcover chips – hides every headcover part.
// Uses a value no AI part name can collide with.
const HEADCOVER_NONE = "__none__";

// Hair style → preview asset (shared by first-generation and revision flows).
const HAIR_ASSET_MAP: Record<string, string> = {
  short: "hair_short",
  long: "hair_long",
  ponytail: "hair_ponytail",
  twintails: "hair_twin_tail_pop",
  spiky: "hair_spiky_ember",
  curly: "hair_curly",
  braids: "hair_braids",
  wavy: "hair_wavy_midnight",
  snakes: "hair_snakes",
};

// Accessory kind → preview slot(s) + asset(s) (shared by first-generation and revision flows).
// A kind may occupy several slots (e.g. shoulder pairs); all of them must be free for it to apply.
type AccessorySlot = "hat" | "back" | "neck" | "leftShoulder" | "rightShoulder" | "aura";
const ACCESSORY_ASSET_MAP: Record<string, Array<{ slot: AccessorySlot; assetId: string }>> = {
  cap: [{ slot: "hat", assetId: "hat_street_cap" }],
  beanie: [{ slot: "hat", assetId: "hat_beanie_soft" }],
  hat: [{ slot: "hat", assetId: "hat_beanie_soft" }],
  helmet: [{ slot: "hat", assetId: "hat_helmet" }],
  crown: [{ slot: "hat", assetId: "hat_crown" }],
  glasses: [{ slot: "hat", assetId: "hat_glasses" }],
  mask: [{ slot: "hat", assetId: "hat_mask" }],
  unicorn_horn: [{ slot: "hat", assetId: "hat_unicorn" }],
  dragon_hood: [{ slot: "hat", assetId: "hat_dragon" }],
  wings: [{ slot: "back", assetId: "back_wings" }],
  backpack: [{ slot: "back", assetId: "back_backpack" }],
  bag: [{ slot: "back", assetId: "back_bag" }],
  tail: [{ slot: "back", assetId: "back_tail" }],
  jetpack: [{ slot: "back", assetId: "back_jetpack_mini" }],
  sword: [{ slot: "back", assetId: "back_blade_rig" }],
  necklace: [{ slot: "neck", assetId: "neck_chain_gold" }],
  scarf: [{ slot: "neck", assetId: "neck_scarf_neo" }],
  horns: [{ slot: "hat", assetId: "hat_cyber_horns" }],
  belt: [{ slot: "neck", assetId: "neck_belt" }],
  gloves: [{ slot: "neck", assetId: "neck_gloves" }],
  shoulder_guards: [
    { slot: "leftShoulder", assetId: "shoulder_guard_left" },
    { slot: "rightShoulder", assetId: "shoulder_guard_right" },
  ],
  shoulder_pet: [{ slot: "rightShoulder", assetId: "shoulder_orb_right" }],
  aura: [{ slot: "aura", assetId: "aura_neon_ring" }],
  flame_aura: [{ slot: "aura", assetId: "aura_flame_orbit" }],
  pixel_aura: [{ slot: "aura", assetId: "aura_pixel_spark" }],
};

// Which outfit fields changed between two plans – shown in the item list after a revision.
function diffOutfits(prev: OutfitPlan, next: OutfitPlan, t: Dict): string[] {
  const name = (value: string) => t.itemNames[value] ?? value;
  const changes: string[] = [];
  if (prev.top !== next.top) changes.push(`${t.fieldTop}: ${name(prev.top)} → ${name(next.top)}`);
  if (prev.bottom !== next.bottom) changes.push(`${t.fieldBottom}: ${name(prev.bottom)} → ${name(next.bottom)}`);
  if (prev.shoes !== next.shoes) changes.push(`${t.fieldShoes}: ${name(prev.shoes)} → ${name(next.shoes)}`);
  if (prev.hair.style !== next.hair.style) changes.push(`${t.fieldHair}: ${name(prev.hair.style)} → ${name(next.hair.style)}`);
  else if (next.hair.style !== "none" && prev.hair.color !== next.hair.color) changes.push(t.itemNewColor(t.fieldHair));
  
  const prevAcc = new Map(prev.accessories.map((a) => [a.kind, a.color]));
  const nextAcc = new Map(next.accessories.map((a) => [a.kind, a.color]));
  for (const [kind] of prevAcc.entries()) if (!nextAcc.has(kind)) changes.push(t.removed(name(kind)));
  for (const [kind, color] of nextAcc.entries()) {
    if (!prevAcc.has(kind)) changes.push(t.added(name(kind)));
    else if (prevAcc.get(kind) !== color) changes.push(t.itemNewColor(name(kind)));
  }

  const prevParts = new Map((prev.customParts ?? []).map((p) => [p.name, p]));
  const nextParts = new Map((next.customParts ?? []).map((p) => [p.name, p]));
  for (const [name] of prevParts.entries()) if (!nextParts.has(name)) changes.push(t.removed(name));
  for (const [name, part] of nextParts.entries()) {
    if (!prevParts.has(name)) changes.push(t.added(name));
    else {
      const prevP = prevParts.get(name)!;
      if (prevP.color !== part.color || prevP.size !== part.size || prevP.attach !== part.attach) {
        changes.push(t.itemUpdated(name));
      }
    }
  }

  return changes;
}

// Map an outfit's accessories to preview slots (one item per slot, first wins).
function mapOutfitToSlots(outfit: OutfitPlan, t: Dict): { slots: Record<string, { assetId: string; color: string }>; conflicts: string[] } {
  const slots: Record<string, { assetId: string; color: string }> = {};
  const conflicts: string[] = [];
  for (const acc of outfit.accessories) {
    const mapped = ACCESSORY_ASSET_MAP[acc.kind];
    if (!mapped) continue;
    const taken = mapped.find((entry) => slots[entry.slot]);
    if (taken) {
      conflicts.push(t.conflict(acc.kind, t.slotNames[taken.slot] ?? taken.slot));
      continue;
    }
    for (const entry of mapped) {
      slots[entry.slot] = { assetId: entry.assetId, color: acc.color };
    }
  }
  return { slots, conflicts };
}

// Item list (uploadable vs preview-only) for the UI panel.
function buildOutfitItemLists(outfit: OutfitPlan, conflicts: string[], t: Dict): { uploadable: string[]; previewOnly: string[] } {
  const name = (value: string) => t.itemNames[value] ?? value;
  const uploadable: string[] = [];
  const previewOnly: string[] = [];
  if (outfit.top !== "none") uploadable.push(`${t.fieldTop} (${name(outfit.top)})`);
  if (outfit.bottom !== "none") uploadable.push(`${t.fieldBottom} (${name(outfit.bottom)})`);
  if (outfit.shoes !== "none") previewOnly.push(`${t.fieldShoes} (${name(outfit.shoes)})`);
  if (outfit.hair.style !== "none") previewOnly.push(`${t.fieldHair} (${name(outfit.hair.style)})`);
  for (const acc of outfit.accessories) {
    if (!ACCESSORY_ASSET_MAP[acc.kind] || conflicts.some((s) => s.includes(acc.kind))) continue;
    const label = name(acc.kind);
    previewOnly.push(label.charAt(0).toUpperCase() + label.slice(1));
  }
  if (outfit.customParts) {
    for (const part of outfit.customParts) {
      previewOnly.push(part.name);
    }
  }
  return { uploadable, previewOnly };
}

export default function Create() {
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [lang, setLang] = useState<Lang>(() => detectLang());
  const t = getDict(lang);
  // Latest dictionary for callbacks/effects that shouldn't re-run on language change.
  const tRef = useRef(t);
  tRef.current = t;
  const chooseLang = (next: Lang) => {
    setLang(next);
    saveLang(next);
  };
  const [previewTexture, setPreviewTexture] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [aiError, setAiError] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPhase, setAiPhase] = useState<string>("");
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [skinStatus, setSkinStatus] = useState<SkinStatus | null>(null);
  const [imageRenderNonce, setImageRenderNonce] = useState(0);
  const [robloxMe, setRobloxMe] = useState<RobloxMe | null>(null);
  // Files the user has already paid a credit for – kept around so a blocked
  // popup/download or a failed direct upload can always be retried for free.
  const [readyFiles, setReadyFiles] = useState<OutfitFiles | null>(null);
  const outfitRef = useRef<{ pantsBase: string; pantsAccent: string; heroUrl?: string; fabricUrl?: string } | null>(null);
  const [garmentConfig, setGarmentConfig] = useState<GarmentConfig>({ top: "tshirt", bottom: "pants" });
  const generateLockRef = useRef(false);
  const [outfitItems, setOutfitItems] = useState<{
    uploadable: string[];
    previewOnly: string[];
    unsupported: string[];
    changed?: string[];
  } | null>(null);
  // Last applied outfit plan + prompt, so a change request can patch instead of rebuild.
  const [lastOutfit, setLastOutfit] = useState<OutfitPlan | null>(null);
  const lastPromptRef = useRef("");
  const [reviseText, setReviseText] = useState("");
  // History stack: one snapshot per successful revision, so «Angre» rolls back one step.
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  // When the AI proposes several headcovers, the child picks which one is shown
  // (null = first, HEADCOVER_NONE = hide all of them).
  const [selectedHeadcover, setSelectedHeadcover] = useState<string | null>(null);

  const { state, setAiPlanPreview, setAiAvatarPreview, deleteLayer, addLayer, applyAiPlan, setPaintSwatch, setAvatarSlot, loadSnapshot } = useDesignStore();

  // The renderer only shows one headcover at a time; when the AI proposes several,
  // the child picks which one via chips. We filter here so the preview updates instantly.
  const headcoverOptions = (lastOutfit?.customParts ?? []).filter((p) => p.shape === "headcover");
  const shownHeadcover =
    selectedHeadcover === HEADCOVER_NONE ? HEADCOVER_NONE : selectedHeadcover ?? headcoverOptions[0]?.name ?? null;
  const displayedCustomParts =
    headcoverOptions.length > 0
      ? lastOutfit?.customParts?.filter((p) => p.shape !== "headcover" || p.name === shownHeadcover)
      : lastOutfit?.customParts;
  const hasDesign = state.layers.length > 0 || Boolean(state.baseColor);

  const refreshStatus = useCallback(async () => {
    try {
      setSkinStatus(await apiGet<SkinStatus>("/payments/skin-status"));
    } catch {
      /* ignore – status is informational */
    }
  }, []);

  const refreshRobloxMe = useCallback(async () => {
    try {
      setRobloxMe(await apiGet<RobloxMe>("/auth/roblox/me"));
    } catch {
      /* ignore – login is optional */
    }
  }, []);

  // Upload the whole outfit straight to the logged-in Roblox account.
  // Returns a status message; falls back to manual downloads if anything fails.
  const directUpload = useCallback(async (files: OutfitFiles): Promise<{ msg: string; allOk: boolean }> => {
    const tt = tRef.current;
    const uploaded: string[] = [];
    const failed: string[] = [];
    for (const item of DIRECT_ITEMS) {
      const dataUrl = files[item.key];
      if (!dataUrl) continue;
      const label = tt.garmentLabels[item.type];
      try {
        const res = await apiPost<{ ok?: boolean; error?: string }>("/auth/roblox/upload", {
          type: item.type,
          name: item.name,
          pngDataUrl: dataUrl,
        });
        if (res.status === 200 && res.data.ok) uploaded.push(label);
        else failed.push(label);
      } catch {
        failed.push(label);
      }
    }
    if (failed.length === 0) {
      return { msg: tt.directDone(uploaded.join(", ")), allOk: true };
    }
    // Something failed – give the user the manual route so nothing is lost.
    openRobloxWithFiles(files);
    const uploadedPart = uploaded.length > 0 ? tt.sentDirectPrefix(uploaded.join(", ")) : "";
    return {
      msg: `${uploadedPart}${tt.directFailed(failed.join(", "))}${tt.uploadDoneMsg}`,
      allOk: false,
    };
  }, []);

  // On mount: load free-count status and finish any payment we returned from.
  useEffect(() => {
    void refreshStatus();
    void refreshRobloxMe();
    const params = new URLSearchParams(window.location.search);
    if (params.get("robloxLogin") === "failed") {
      setUploadStatus(tRef.current.robloxLoginAborted);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("robloxLogin") === "ok") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    const paidSession = params.get("paid");
    if (!paidSession) return;
    const cleanUrl = window.location.pathname;
    (async () => {
      const tt = tRef.current;
      try {
        const { paid } = await apiGet<{ paid: boolean }>(`/payments/verify?session_id=${encodeURIComponent(paidSession)}`);
        const pendingRaw = window.localStorage.getItem(PENDING_SKIN_KEY);
        const pending = pendingRaw ? parsePendingOutfit(pendingRaw) : null;
        if (paid && pending) {
          const consume = await apiPost<{ ok?: boolean }>("/payments/consume-free");
          if (consume.status === 200 && consume.data.ok) {
            // Keep the files recoverable until delivery is confirmed.
            setReadyFiles(pending);
            const me = await apiGet<RobloxMe>("/auth/roblox/me").catch(() => null);
            if (me?.loggedIn) {
              setUploadStatus(tt.paymentApprovedSending);
              const result = await directUpload(pending);
              if (result.allOk) window.localStorage.removeItem(PENDING_SKIN_KEY);
              setUploadStatus(`${tt.paidCreditsPrefix} ${result.msg}`);
            } else {
              openRobloxWithFiles(pending);
              setUploadStatus(`${tt.paidCreditsPrefix} ${tt.uploadDoneMsg} ${tt.paidNoDownloadHint}`);
            }
          } else {
            setUploadStatus(tt.paidButConsumeFailed);
          }
        } else if (paid) {
          setUploadStatus(tt.paidNoPending);
        } else {
          setUploadStatus(tt.paymentNotCompleted);
        }
      } catch {
        setUploadStatus(tRef.current.paymentVerifyFailed);
      } finally {
        window.history.replaceState({}, "", cleanUrl);
        void refreshStatus();
      }
    })();
  }, [refreshStatus, refreshRobloxMe, directUpload]);

  const handleOverlayImageReady = useCallback(() => {
    setImageRenderNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!offscreenCanvasRef.current) offscreenCanvasRef.current = document.createElement("canvas");
    const offscreen = offscreenCanvasRef.current;
    const idHandle = window.setTimeout(() => {
      setPreviewTexture(renderDesignToCanvas(state, offscreen, { onOverlayImageReady: handleOverlayImageReady, scale: 3 }));
    }, 20);
    return () => window.clearTimeout(idHandle);
  }, [handleOverlayImageReady, imageRenderNonce, state]);

  const generate = async (promptOverride?: string) => {
    const usedPrompt = (promptOverride ?? prompt).trim();
    // Synchronous lock: state updates are async, so a fast double-tap could start two runs.
    if (generateLockRef.current || aiLoading || !usedPrompt) return;
    generateLockRef.current = true;
    setAiLoading(true);
    setAiError("");
    setUploadStatus("");
    setAiPhase(t.phaseCreating);
    setOutfitItems(null);
    setUndoStack([]); // a brand-new skin starts a fresh history
    try {
      const response = normalizeAiResponse(await aiGenerateDesign({ prompt: usedPrompt, itemType: "classic_shirt", style: "AI velger", theme: usedPrompt }));

      // Detect which garments were asked for. Kids misspell ("t-sjhortet"), so we
      // combine the raw prompt with the AI's own interpretation (title/style/placement) —
      // the AI understands typos even when exact word-matching fails.
      const r = response.result as unknown as {
        title?: string; style?: string; theme?: string;
        designElements?: string[];
        placement?: { front?: string; leftLeg?: string; rightLeg?: string };
      };
      const pLow = usedPrompt.toLowerCase();
      const aiText = [r.title, r.style, r.theme, ...(r.designElements ?? []), r.placement?.front]
        .filter(Boolean).join(" ").toLowerCase();
      const combined = `${pLow} ${aiText}`;
      const aiUsesLegs = Boolean(
        (r.placement?.leftLeg && r.placement.leftLeg !== "not_used") ||
        (r.placement?.rightLeg && r.placement.rightLeg !== "not_used"),
      );

      // Primary source: the AI's own structured reading of the prompt (handles typos,
      // Norwegian words and outfit concepts like "treningsdress" = jacket + pants + shoes).
      const aiGarments = response.result.garments;

      let wantsTop: boolean;
      let wantsBottom: boolean;
      let wantsShoes: boolean;
      let topType: "hoodie" | "sweater" | "tshirt" | "jacket" | "dress" = "sweater";
      let bottomType: "pants" | "shorts" = "pants";

      if (aiGarments) {
        wantsTop = aiGarments.top !== "none";
        wantsBottom = aiGarments.bottom !== "none";
        wantsShoes = aiGarments.shoes;
        if (aiGarments.top === "hoodie") topType = "hoodie";
        else if (aiGarments.top === "tshirt") topType = "tshirt";
        else if (aiGarments.top === "jacket") topType = "jacket";
        else topType = "sweater";
        bottomType = aiGarments.bottom === "shorts" ? "shorts" : "pants";
      } else {
        // Fallback: word matching on prompt + AI text.
        const mentionsTop = /hettegenser|hette|hoodie|genser|sweater|skjort|sjort|shirt|jakke|jacket|topp|overdel|hood/i.test(combined);
        const mentionsBottom = /shorts|bukse|olabukse|jeans|jogge|pants|underdel|dress|tracksuit/i.test(combined);
        const mentionsShoes = /\bsko\b|joggesko|sneakers|boots|støvle|shoe/i.test(combined);
        const fullOutfit = !mentionsTop && !mentionsBottom && !mentionsShoes;
        wantsTop = mentionsTop || fullOutfit;
        wantsBottom = mentionsBottom || (fullOutfit && aiUsesLegs) || (fullOutfit && !aiText);
        wantsShoes = mentionsShoes;
        if (/hettegenser|hette|hoodie|hood/i.test(combined)) topType = "hoodie";
        else if (/tskjorte|t-skjorte|t-shirt|tshirt|skjort|sjort|shirt|topp/i.test(combined)) topType = "tshirt";
        if (/shorts/i.test(combined)) bottomType = "shorts";
      }

      // Use outfit plan if available, otherwise fall back to garment detection
      const outfit = response.result.outfit;
      if (outfit) {
        // AI gave us a full structured outfit plan
        setGarmentConfig({
          top: outfit.top === "none" ? null : (outfit.top as "hoodie" | "sweater" | "tshirt" | "jacket" | "dress"),
          bottom: outfit.bottom === "none" ? null : outfit.bottom as "pants" | "shorts" | "skirt",
          shoes: outfit.shoes === "none" ? null : outfit.shoes as "sneakers" | "boots",
          shoesColor: outfit.shoesColor ?? null,
        });
      } else {
        setGarmentConfig({
          top: wantsTop ? topType : null,
          bottom: wantsBottom ? bottomType : null,
          shoes: wantsShoes ? "sneakers" : null,
        });
      }
      const previewAvatar = buildAiAvatarLook(
        [response.result.style, ...response.result.intent.styleVibes].join(" "),
        response.result.colorPalette,
      );
      // Plain clothing prompts should show a clean avatar (like the Roblox editor) —
      // only themed prompts (drage, ninja, superhelt …) get hats/chains/auras/effects.
      const wantsCosmetics = /drage|dragon|ninja|superhelt|superhero|zombie|astronaut|romfar|hai|shark|lava|gamer|prinsesse|princess|enhjørning|unicorn|engel|angel|ving|wing|hjelm|helmet|caps|lue|hatt|hat\b|kjede|chain|krone|crown|horn/i.test(usedPrompt);
      // Hairstyle should only change when the prompt actually asks for hair.
      const wantsHair = /hår|frisyre|hair|hestehale|ponytail|fletter|braid|krøll|curl|bob\b|panneluggen|lugg/i.test(usedPrompt);
      if (!wantsHair) {
        previewAvatar.slots = { ...previewAvatar.slots, hair: null };
      }
      if (!wantsCosmetics) {
        previewAvatar.slots = {
          ...previewAvatar.slots,
          hat: null,
          neck: null,
          leftShoulder: null,
          rightShoulder: null,
          back: null,
          aura: null,
        };
      }
      const resolvedSlots = resolveAvatarSlotAssets(response.result);
      if (!wantsCosmetics) resolvedSlots.length = 0;
      for (const slotPlan of resolvedSlots) {
        previewAvatar.slots = {
          ...previewAvatar.slots,
          [slotPlan.slot]: {
            assetId: slotPlan.assetId,
            scale: 1,
            visible: true,
            color: slotPlan.color,
            offset: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
          },
        };
      }

      // Apply outfit accessories and hair if available
      if (outfit) {
        const unsupportedItems: string[] = [...(outfit.unsupported ?? [])];
        
        // Hair mapping
        if (outfit.hair.style !== "none") {
          const hairAssetId = HAIR_ASSET_MAP[outfit.hair.style];
          if (hairAssetId) {
            previewAvatar.slots = {
              ...previewAvatar.slots,
              hair: {
                assetId: hairAssetId,
                scale: 1,
                visible: true,
                color: outfit.hair.color,
                offset: { x: 0, y: 0.05, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
              },
            };
          }
        }

        // Accessory mapping (one item per slot; first wins)
        const { slots: accessorySlots, conflicts } = mapOutfitToSlots(outfit, t);
        unsupportedItems.push(...conflicts);
        for (const [slot, item] of Object.entries(accessorySlots)) {
          previewAvatar.slots = {
            ...previewAvatar.slots,
            [slot]: {
              assetId: item.assetId,
              scale: 1,
              visible: true,
              color: item.color,
              offset: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
            },
          };
        }

        // Build item list for UI
        const { uploadable, previewOnly } = buildOutfitItemLists(outfit, conflicts, t);
        setOutfitItems({
          uploadable,
          previewOnly,
          unsupported: unsupportedItems,
        });
      } else {
        // No outfit plan – just show what we rendered
        const uploadable: string[] = [];
        const previewOnlyItems: string[] = [];
        if (wantsTop) uploadable.push(t.fieldTop);
        if (wantsBottom) uploadable.push(t.fieldBottom);
        if (wantsShoes) previewOnlyItems.push(t.fieldShoes);
        setOutfitItems({ uploadable, previewOnly: previewOnlyItems, unsupported: [] });
      }
      // Remember the plan so the child can revise it («gjør vingene større») without starting over.
      setLastOutfit(outfit ?? null);
      setSelectedHeadcover(null);
      lastPromptRef.current = usedPrompt;
      const payload = {
        model: "ClassicTextureAI.v3",
        garmentType: "shirt",
        style: response.result.style,
        palette: response.result.colorPalette,
        zones: response.result.placement,
        avatarLook: previewAvatar,
        layers: response.result.modules.map((module) => mapAiModuleToLayer(module)),
      };
      const parsed = classicTextureAiSchema.parse(payload);
      const plan = parseClassicTextureAiPlan(parsed);
      const currentLayers = useDesignStore.getState().state.layers;
      for (const layer of currentLayers) deleteLayer(layer.id);
      setAiPlanPreview(plan.layers);
      setAiAvatarPreview(plan.avatarLook ?? null);
      applyAiPlan();
      if (parsed.palette[0]) setPaintSwatch(parsed.palette[0]);

      // Color the leg zones only when the outfit actually includes a bottom.
      const pantsColors = pickPantsColors(parsed.palette);
      outfitRef.current = { pantsBase: pantsColors.base, pantsAccent: pantsColors.accent };
      if (wantsBottom) {
        for (const legZone of ["left_leg_front", "right_leg_front", "left_leg_back", "right_leg_back"]) {
          addLayer({
            name: "Bukse",
            type: "paintLayerSet",
            zone: legZone,
            color: pantsColors.base,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
          });
        }
      }

      // Draw only the pieces that were asked for. A standalone motif is only added
      // when the prompt asks for one (logo, trykk, motiv, figur …) or is a themed skin.
      const wantsMotif = /logo|motiv|trykk|bilde|figur|mønster|print/i.test(pLow) || wantsCosmetics;
      setAiPhase(t.phaseDrawing);
      const skipped = { status: 0, data: {} as { imageUrl?: string } };
      const [top, bottom, hero] = await Promise.all([
        wantsTop ? apiPost<{ imageUrl?: string }>("/ai/hero-image", { prompt: (response.result.outfit?.topDescription ?? usedPrompt).slice(0, 600), kind: "garment-top" }) : Promise.resolve(skipped),
        wantsBottom ? apiPost<{ imageUrl?: string }>("/ai/hero-image", { prompt: (response.result.outfit?.bottomDescription ?? usedPrompt).slice(0, 600), kind: "garment-bottom" }) : Promise.resolve(skipped),
        wantsMotif ? apiPost<{ imageUrl?: string }>("/ai/hero-image", { prompt: usedPrompt }) : Promise.resolve(skipped),
      ]);

      const topUrl = top.status === 200 ? top.data.imageUrl : undefined;
      const bottomUrl = bottom.status === 200 ? bottom.data.imageUrl : undefined;
      if (topUrl) {
        // The top garment covers chest, back and both sleeves edge-to-edge.
        for (const zone of ["front", "back", "left_sleeve", "right_sleeve"]) {
          addLayer({
            name: "AI-overdel",
            type: "imageLayer",
            zone,
            image: topUrl,
            transform: { x: 0, y: 0, scale: 1.6, rotation: 0, opacity: 1 },
          });
        }
      }
      if (bottomUrl) {
        // The bottom garment covers all four leg zones edge-to-edge.
        for (const zone of ["left_leg_front", "right_leg_front", "left_leg_back", "right_leg_back"]) {
          addLayer({
            name: "AI-bukse",
            type: "imageLayer",
            zone,
            image: bottomUrl,
            transform: { x: 0, y: 0, scale: 2.4, rotation: 0, opacity: 1 },
          });
        }
      }

      if (hero.status === 200 && hero.data.imageUrl) {
        outfitRef.current = { pantsBase: pantsColors.base, pantsAccent: pantsColors.accent, heroUrl: hero.data.imageUrl, fabricUrl: bottomUrl };
        addLayer({
          name: "AI-motiv",
          type: "imageLayer",
          zone: "front",
          image: hero.data.imageUrl,
          transform: { x: 0, y: -6, scale: 0.6, rotation: 0, opacity: 1 },
        });
      } else {
        outfitRef.current = { pantsBase: pantsColors.base, pantsAccent: pantsColors.accent, fabricUrl: bottomUrl };
        if ((wantsTop && !topUrl) || (wantsBottom && !bottomUrl)) setAiError(t.errMotif);
      }
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 429) {
        setAiError(t.errBusy);
      } else {
        setAiError(t.errGeneric);
      }
    } finally {
      generateLockRef.current = false;
      setAiLoading(false);
      setAiPhase("");
    }
  };

  // Revise the existing skin («gjør vingene større», «fjern sekken») without rebuilding
  // everything: only fields the AI changed are re-applied; unchanged textures are kept.
  const revise = async () => {
    const text = reviseText.trim();
    if (generateLockRef.current || aiLoading || !text) return;
    if (!lastOutfit) {
      // Nothing to patch – treat it as a fresh design request.
      setPrompt(text);
      setReviseText("");
      await generate(text);
      return;
    }
    generateLockRef.current = true;
    setAiLoading(true);
    setAiError("");
    setUploadStatus("");
    setAiPhase(t.phaseRevising);
    // Snapshot the current look BEFORE any mutation, so «Angre» can restore it.
    const snapshot: UndoSnapshot = {
      designState: structuredClone(useDesignStore.getState().state),
      garmentConfig: { ...garmentConfig },
      outfit: lastOutfit,
      prompt: lastPromptRef.current,
      outfitItems: outfitItems ? { ...outfitItems } : null,
      outfitRefValue: outfitRef.current ? { ...outfitRef.current } : null,
    };
    try {
      const res = await apiPost<unknown>("/ai/generate", {
        prompt: text,
        itemType: "classic_shirt",
        style: "AI velger",
        theme: text,
        previousOutfit: lastOutfit,
      });
      if (res.status !== 200) {
        const err = new Error(`revise failed ${res.status}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      const response = normalizeAiResponse(res.data);
      const outfit = response.result.outfit;
      if (!outfit) throw new Error("AI returned no outfit plan");

      const changed = diffOutfits(lastOutfit, outfit, t);

      // Garment config drives the 3D preview meshes.
      setGarmentConfig({
        top: outfit.top === "none" ? null : (outfit.top as "hoodie" | "sweater" | "tshirt" | "jacket" | "dress"),
        bottom: outfit.bottom === "none" ? null : outfit.bottom as "pants" | "shorts" | "skirt",
        shoes: outfit.shoes === "none" ? null : outfit.shoes as "sneakers" | "boots",
        shoesColor: outfit.shoesColor ?? null,
      });

      // Only touch the avatar slots that actually changed – everything else stays put.
      const hairChanged = lastOutfit.hair.style !== outfit.hair.style || lastOutfit.hair.color !== outfit.hair.color;
      if (hairChanged) {
        const hairAssetId = outfit.hair.style !== "none" ? HAIR_ASSET_MAP[outfit.hair.style] : undefined;
        setAvatarSlot("hair", hairAssetId ? {
          assetId: hairAssetId,
          scale: 1,
          visible: true,
          color: outfit.hair.color,
          offset: { x: 0, y: 0.05, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
        } : null);
      }
      const prevSlots = mapOutfitToSlots(lastOutfit, t).slots;
      const { slots: nextSlots, conflicts } = mapOutfitToSlots(outfit, t);
      for (const slot of new Set([...Object.keys(prevSlots), ...Object.keys(nextSlots)])) {
        const before = prevSlots[slot];
        const after = nextSlots[slot];
        if (before?.assetId === after?.assetId && before?.color === after?.color) continue;
        setAvatarSlot(slot as "hat" | "back" | "neck", after ? {
          assetId: after.assetId,
          scale: 1,
          visible: true,
          color: after.color,
          offset: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
        } : null);
      }

      // Item list: what the skin contains now + what was just changed.
      const unsupportedItems = [...(outfit.unsupported ?? []), ...conflicts];
      const { uploadable, previewOnly } = buildOutfitItemLists(outfit, conflicts, t);
      setOutfitItems({ uploadable, previewOnly, unsupported: unsupportedItems, changed });

      // Textures: only regenerate garment art for pieces that changed; keep the rest.
      const topChanged = lastOutfit.top !== outfit.top || lastOutfit.topDescription !== outfit.topDescription;
      const bottomChanged = lastOutfit.bottom !== outfit.bottom || lastOutfit.bottomDescription !== outfit.bottomDescription;
      const combinedPrompt = `${lastPromptRef.current}. Endring: ${text}`.slice(0, 600);
      const layersNow = () => useDesignStore.getState().state.layers;
      if (topChanged || bottomChanged) {
        setAiPhase(t.phaseDrawingNew);
        const skipped = { status: 0, data: {} as { imageUrl?: string } };
        const [top, bottom] = await Promise.all([
          topChanged && outfit.top !== "none" ? apiPost<{ imageUrl?: string }>("/ai/hero-image", { prompt: (outfit.topDescription ?? combinedPrompt).slice(0, 600), kind: "garment-top" }) : Promise.resolve(skipped),
          bottomChanged && outfit.bottom !== "none" ? apiPost<{ imageUrl?: string }>("/ai/hero-image", { prompt: (outfit.bottomDescription ?? combinedPrompt).slice(0, 600), kind: "garment-bottom" }) : Promise.resolve(skipped),
        ]);
        if (topChanged) {
          for (const layer of layersNow().filter((l) => l.name === "AI-overdel")) deleteLayer(layer.id);
          const topUrl = top.status === 200 ? top.data.imageUrl : undefined;
          if (topUrl) {
            for (const zone of ["front", "back", "left_sleeve", "right_sleeve"]) {
              addLayer({ name: "AI-overdel", type: "imageLayer", zone, image: topUrl, transform: { x: 0, y: 0, scale: 1.6, rotation: 0, opacity: 1 } });
            }
          } else if (outfit.top !== "none") {
            setAiError(t.errReviseTopDraw);
          }
        }
        if (bottomChanged) {
          for (const layer of layersNow().filter((l) => l.name === "AI-bukse" || l.name === "Bukse")) deleteLayer(layer.id);
          const bottomUrl = bottom.status === 200 ? bottom.data.imageUrl : undefined;
          if (outfit.bottom !== "none") {
            const pantsColors = pickPantsColors(response.result.colorPalette);
            for (const legZone of ["left_leg_front", "right_leg_front", "left_leg_back", "right_leg_back"]) {
              addLayer({ name: "Bukse", type: "paintLayerSet", zone: legZone, color: pantsColors.base, transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 } });
            }
            if (bottomUrl) {
              for (const zone of ["left_leg_front", "right_leg_front", "left_leg_back", "right_leg_back"]) {
                addLayer({ name: "AI-bukse", type: "imageLayer", zone, image: bottomUrl, transform: { x: 0, y: 0, scale: 2.4, rotation: 0, opacity: 1 } });
              }
            }
            outfitRef.current = { pantsBase: pantsColors.base, pantsAccent: pantsColors.accent, heroUrl: outfitRef.current?.heroUrl, fabricUrl: bottomUrl };
          } else {
            outfitRef.current = outfitRef.current ? { ...outfitRef.current, fabricUrl: undefined } : null;
          }
        }
      }

      setLastOutfit(outfit);
      // Keep the child's headcover choice only if that part still exists in the new plan
      // («Ingen» is always kept – the child asked to hide headcovers).
      setSelectedHeadcover((current) =>
        current === HEADCOVER_NONE ||
        (current && (outfit.customParts ?? []).some((p) => p.shape === "headcover" && p.name === current))
          ? current
          : null,
      );
      lastPromptRef.current = `${lastPromptRef.current}. ${text}`.slice(0, 900);
      setReviseText("");
      // The revision succeeded – remember what it replaced so «Angre» can undo it.
      setUndoStack((stack) => [...stack.slice(-(UNDO_STACK_LIMIT - 1)), snapshot]);
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 429) {
        setAiError(t.errBusy);
      } else {
        setAiError(t.errReviseGeneric);
      }
    } finally {
      generateLockRef.current = false;
      setAiLoading(false);
      setAiPhase("");
    }
  };

  // «Angre»: restore the previous outfit plan, garment meshes, avatar slots and
  // texture layers in one tap – no AI call, instant.
  const undoLast = () => {
    if (aiLoading || undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    loadSnapshot(structuredClone(snapshot.designState));
    setGarmentConfig(snapshot.garmentConfig);
    setLastOutfit(snapshot.outfit);
    setSelectedHeadcover(null);
    lastPromptRef.current = snapshot.prompt;
    setOutfitItems(snapshot.outfitItems);
    outfitRef.current = snapshot.outfitRefValue;
    setAiError("");
    setUploadStatus("");
  };

  const renderExportFiles = async (): Promise<OutfitFiles | null> => {
    if (!offscreenCanvasRef.current) offscreenCanvasRef.current = document.createElement("canvas");
    const canvas = offscreenCanvasRef.current;
    if (!canvas || !hasDesign) return null;
    await preloadOverlayImages(state);
    const shirt = renderDesignToCanvas(state, canvas, { onOverlayImageReady: handleOverlayImageReady, target: "export" });
    const outfit = outfitRef.current;
    const pantsBase = outfit?.pantsBase ?? state.baseColor ?? "#1e293b";
    const pantsAccent = outfit?.pantsAccent ?? state.paintSwatch;
    const pants = await renderPantsTexture({ base: pantsBase, accent: pantsAccent, motifUrl: outfit?.heroUrl, fabricUrl: outfit?.fabricUrl });
    const tshirt = outfit?.heroUrl ? await renderTShirtTexture(outfit.heroUrl) : undefined;
    return { shirt, pants: pants || undefined, tshirt };
  };

  const uploadToRoblox = async () => {
    if (uploadBusy || !hasDesign) return;
    setUploadBusy(true);
    setUploadStatus("");
    try {
      const files = await renderExportFiles();
      if (!files) return;

      const consume = await apiPost<{ ok?: boolean; needsPayment?: boolean }>("/payments/consume-free");
      if (consume.status === 200 && consume.data.ok) {
        setReadyFiles(files);
        if (robloxMe?.loggedIn) {
          setUploadStatus(t.sendingDirect);
          setUploadStatus((await directUpload(files)).msg);
        } else {
          openRobloxWithFiles(files);
          setUploadStatus(t.uploadDoneMsg);
        }
        await refreshStatus();
        return;
      }

      if (consume.status === 402 || consume.data.needsPayment) {
        // Free skins used up – save the outfit and send the user to Stripe checkout.
        // Never let a storage failure block the payment itself.
        try {
          window.localStorage.setItem(PENDING_SKIN_KEY, JSON.stringify(files));
        } catch {
          try {
            // Storage full (data URLs are big) – keep at least the shirt.
            window.localStorage.setItem(PENDING_SKIN_KEY, files.shirt);
          } catch {
            /* storage unavailable – user can regenerate after payment */
          }
        }
        setUploadStatus(t.sendingToPayment);
        const checkout = await apiPost<{ checkoutUrl?: string; error?: string }>("/payments/create-checkout-session");
        if (checkout.data.checkoutUrl) {
          window.location.href = checkout.data.checkoutUrl;
          return;
        }
        setUploadStatus(checkout.data.error ?? t.cantStartPayment);
        return;
      }

      setUploadStatus(t.genericFail);
    } catch {
      setUploadStatus(t.genericFail);
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col items-center gap-8">
        <header className="relative w-full text-center space-y-2">
          <div className="absolute right-0 top-0 flex gap-1">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                title={l.label}
                aria-label={l.label}
                onClick={() => chooseLang(l.code)}
                className={`rounded-lg border px-2 py-1 text-lg transition ${
                  lang === l.code ? "border-emerald-400 bg-emerald-500/20" : "border-slate-700 bg-slate-900/70 opacity-60 hover:opacity-100"
                }`}
              >
                {l.flag}
              </button>
            ))}
          </div>
          <h1 className="text-4xl font-bold tracking-tight">My Skins</h1>
          <p className="text-lg text-slate-300">{t.tagline}</p>
        </header>

        <section className="w-full">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {t.ideas.map((idea) => (
              <button
                key={idea.label}
                type="button"
                disabled={aiLoading}
                onClick={() => {
                  setPrompt(idea.prompt);
                  void generate(idea.prompt);
                }}
                className="flex flex-col items-center gap-1 rounded-2xl border-2 border-slate-700 bg-slate-900/70 py-4 transition hover:border-emerald-400 hover:bg-slate-800 active:scale-95 disabled:opacity-40"
              >
                <span className="text-4xl sm:text-5xl leading-none">{idea.emoji}</span>
                <span className="text-sm font-semibold text-slate-200">{idea.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="w-full">
          <div className="h-[520px] rounded-2xl border border-slate-800 overflow-hidden">
            <AvatarPreview
              textureUrl={previewTexture}
              previewMode="avatar"
              itemType="shirt"
              avatarState={state.avatar}
              studioMode
              animated
              garment={garmentConfig}
              customParts={displayedCustomParts}
            />
          </div>

          {headcoverOptions.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm">
              <div className="mb-2 font-semibold text-violet-300">{t.headcoverChoiceTitle}</div>
              <div className="flex flex-wrap gap-2">
                {headcoverOptions.map((part) => (
                  <button
                    key={part.name}
                    type="button"
                    onClick={() => setSelectedHeadcover(part.name)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition active:scale-95 ${
                      part.name === shownHeadcover
                        ? "border-violet-400 bg-violet-500/20 text-violet-200"
                        : "border-slate-600/60 bg-slate-800/60 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full border border-slate-500/50" style={{ backgroundColor: part.color }} />
                    {part.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedHeadcover(HEADCOVER_NONE)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition active:scale-95 ${
                    shownHeadcover === HEADCOVER_NONE
                      ? "border-violet-400 bg-violet-500/20 text-violet-200"
                      : "border-slate-600/60 bg-slate-800/60 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  🚫 {t.headcoverNone}
                </button>
              </div>
            </div>
          )}
          
          {outfitItems && (outfitItems.uploadable.length > 0 || outfitItems.previewOnly.length > 0 || outfitItems.unsupported.length > 0 || (outfitItems.changed?.length ?? 0) > 0) && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3 text-sm">
              {(outfitItems.changed?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-amber-400">{t.changedNow}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {outfitItems.changed?.map((item, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {outfitItems.uploadable.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Upload className="h-4 w-4 text-emerald-400" />
                    <span className="font-semibold text-emerald-400">{t.goesIntoRoblox}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{t.goesIntoRobloxHint}</p>
                  <div className="flex flex-wrap gap-2">
                    {outfitItems.uploadable.map((item, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {outfitItems.previewOnly.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-sky-400" />
                    <span className="font-semibold text-sky-400">{t.previewOnlyTitle}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{t.previewOnlyHint}</p>
                  <div className="flex flex-wrap gap-2">
                    {outfitItems.previewOnly.map((item, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {outfitItems.unsupported.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-slate-400">{t.unsupportedTitle}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {outfitItems.unsupported.map((item, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-slate-700/40 text-slate-400 border border-slate-600/40 text-xs">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="w-full space-y-4">
          {aiLoading ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 p-5 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-lg font-semibold">🎨 {aiPhase || t.loadingDefault}</p>
              <p className="text-sm text-slate-300">{t.loadingWait}</p>
            </div>
          ) : null}
          {aiError ? <p className="text-center text-sm text-red-400">{aiError}</p> : null}

          <div className="flex flex-col items-center gap-2">
            <Button
              size="lg"
              className="h-16 w-full max-w-md rounded-2xl bg-emerald-500 px-10 text-xl font-bold text-emerald-950 hover:bg-emerald-400"
              onClick={() => void uploadToRoblox()}
              disabled={!hasDesign || uploadBusy || aiLoading}
            >
              {uploadBusy ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Upload className="mr-2 h-6 w-6" />}
              {uploadBusy ? t.working : t.sendToRoblox}
            </Button>
            {robloxMe?.configured ? (
              robloxMe.loggedIn ? (
                <p className="text-sm text-slate-300">
                  {t.loggedInAsPrefix} <span className="font-semibold">{robloxMe.name}</span> {t.loggedInAsSuffix}{" "}
                  <button
                    type="button"
                    className="underline text-slate-400 hover:text-slate-200"
                    onClick={() => {
                      void apiPost("/auth/roblox/logout").then(() => setRobloxMe({ loggedIn: false, configured: true }));
                    }}
                  >
                    {t.logout}
                  </button>
                </p>
              ) : (
                <button
                  type="button"
                  className="rounded-xl border-2 border-slate-600 bg-slate-900 px-5 py-2 text-sm font-semibold text-slate-200 hover:border-emerald-400"
                  onClick={() => {
                    window.location.href = `${API_BASE}/auth/roblox/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
                  }}
                >
                  {t.loginWithRoblox}
                </button>
              )
            ) : null}
            {skinStatus ? (
              <p className="text-sm text-slate-400">
                {skinStatus.paidCredits > 0 ? t.creditsLeft(skinStatus.paidCredits) : t.priceInfo}
              </p>
            ) : null}
            {uploadStatus ? <p className="text-sm text-emerald-400 text-center max-w-lg">{uploadStatus}</p> : null}
            {readyFiles ? (
              <button
                type="button"
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:border-emerald-400"
                onClick={() => openRobloxWithFiles(readyFiles)}
              >
                {t.redownload}
              </button>
            ) : null}
            {!hasDesign && !aiLoading ? <p className="text-sm text-slate-500">{t.tapHint}</p> : null}
          </div>

          {hasDesign && lastOutfit && !aiLoading ? (
            <div className="w-full rounded-xl border-2 border-sky-500/40 bg-sky-500/5 p-4">
              <p className="mb-2 text-sm font-semibold text-sky-300">{t.reviseTitle}</p>
              <form
                className="flex flex-col sm:flex-row gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void revise();
                }}
              >
                <Input
                  value={reviseText}
                  onChange={(event) => setReviseText(event.target.value)}
                  placeholder={t.revisePlaceholder}
                  className="h-12 bg-slate-900 border-slate-700 text-base"
                  disabled={aiLoading}
                />
                <Button type="submit" size="lg" className="h-12 px-6 bg-sky-500 text-sky-950 hover:bg-sky-400" disabled={aiLoading || !reviseText.trim()}>
                  <Sparkles className="mr-2 h-5 w-5" />
                  {t.reviseButton}
                </Button>
              </form>
              {undoStack.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-12 w-full border-2 border-amber-500/50 bg-amber-500/10 text-base font-semibold text-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
                  onClick={undoLast}
                  disabled={aiLoading}
                >
                  <Undo2 className="mr-2 h-5 w-5" />
                  {t.undoButton}
                </Button>
              ) : null}
            </div>
          ) : null}

          <details className="w-full rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-300">{t.customSummary}</summary>
            <form
              className="mt-3 flex flex-col sm:flex-row gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void generate();
              }}
            >
              <Input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={t.customPlaceholder}
                className="h-12 bg-slate-900 border-slate-700 text-base"
                disabled={aiLoading}
              />
              <Button type="submit" size="lg" className="h-12 px-6" disabled={aiLoading || !prompt.trim()}>
                <Sparkles className="mr-2 h-5 w-5" />
                {t.createButton}
              </Button>
            </form>
          </details>
        </section>
      </div>
    </div>
  );
}
