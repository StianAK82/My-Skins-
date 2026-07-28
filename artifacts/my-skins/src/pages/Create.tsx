import { useCallback, useEffect, useRef, useState } from "react";
import { aiGenerateDesign } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Upload, Loader2 } from "lucide-react";
import { AvatarPreview } from "@/components/editor/AvatarPreview";
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
const IDEAS: Array<{ emoji: string; label: string; prompt: string }> = [
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
];

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

const DIRECT_ITEMS: Array<{ key: keyof OutfitFiles; type: string; name: string; label: string }> = [
  { key: "shirt", type: "shirt", name: "My Skins overdel", label: "overdelen" },
  { key: "pants", type: "pants", name: "My Skins bukse", label: "buksa" },
  { key: "tshirt", type: "tshirt", name: "My Skins t-skjorte", label: "t-skjorta" },
];

const UPLOAD_DONE_MSG =
  "Antrekket er lastet ned som tre filer: overdel (Shirt), bukse (Pants) og t-skjorte-motiv. Roblox sin side er åpnet – last opp overdelen som «Shirt», buksa som «Pants» og motivet som «T-Shirt».";

export default function Create() {
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const generateLockRef = useRef(false);

  const { state, setAiPlanPreview, setAiAvatarPreview, deleteLayer, addLayer, applyAiPlan, setPaintSwatch } = useDesignStore();
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
    const uploaded: string[] = [];
    const failed: string[] = [];
    for (const item of DIRECT_ITEMS) {
      const dataUrl = files[item.key];
      if (!dataUrl) continue;
      try {
        const res = await apiPost<{ ok?: boolean; error?: string }>("/auth/roblox/upload", {
          type: item.type,
          name: item.name,
          pngDataUrl: dataUrl,
        });
        if (res.status === 200 && res.data.ok) uploaded.push(item.label);
        else failed.push(item.label);
      } catch {
        failed.push(item.label);
      }
    }
    if (failed.length === 0) {
      return { msg: `🎉 Ferdig! Antrekket (${uploaded.join(", ")}) er sendt rett til Roblox-kontoen din. Husk: Roblox tar 10 Robux per plagg.`, allOk: true };
    }
    // Something failed – give the user the manual route so nothing is lost.
    openRobloxWithFiles(files);
    const uploadedPart = uploaded.length > 0 ? `Sendt direkte: ${uploaded.join(", ")}. ` : "";
    return {
      msg: `${uploadedPart}Roblox godtok ikke direkte opplasting av ${failed.join(", ")} (dette kan kreve ID-verifisert konto og minst 10 Robux). ${UPLOAD_DONE_MSG}`,
      allOk: false,
    };
  }, []);

  // On mount: load free-count status and finish any payment we returned from.
  useEffect(() => {
    void refreshStatus();
    void refreshRobloxMe();
    const params = new URLSearchParams(window.location.search);
    if (params.get("robloxLogin") === "failed") {
      setUploadStatus("Roblox-innloggingen ble avbrutt. Prøv igjen, eller last ned filene manuelt.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("robloxLogin") === "ok") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    const paidSession = params.get("paid");
    if (!paidSession) return;
    const cleanUrl = window.location.pathname;
    (async () => {
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
              setUploadStatus("Betaling godkjent! Sender antrekket til Roblox…");
              const result = await directUpload(pending);
              if (result.allOk) window.localStorage.removeItem(PENDING_SKIN_KEY);
              setUploadStatus(`Betaling godkjent – du har fått 3 opplastinger! ${result.msg}`);
            } else {
              openRobloxWithFiles(pending);
              setUploadStatus(`Betaling godkjent – du har fått 3 opplastinger! ${UPLOAD_DONE_MSG} Startet ikke nedlastingen? Bruk knappen «Last ned filene på nytt» under.`);
            }
          } else {
            setUploadStatus("Betaling godkjent, men opplastingen kunne ikke brukes. Trykk «Last opp til Roblox» igjen.");
          }
        } else if (paid) {
          setUploadStatus("Betaling godkjent – du har fått 3 opplastinger! Lag skinnet på nytt og trykk «Last opp til Roblox».");
        } else {
          setUploadStatus("Betalingen ble ikke fullført. Prøv igjen.");
        }
      } catch {
        setUploadStatus("Kunne ikke bekrefte betalingen. Prøv igjen.");
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
    setAiPhase("Lager designet…");
    try {
      const response = normalizeAiResponse(await aiGenerateDesign({ prompt: usedPrompt, itemType: "classic_shirt", style: "AI velger", theme: usedPrompt }));
      const previewAvatar = buildAiAvatarLook(
        [response.result.style, ...response.result.intent.styleVibes].join(" "),
        response.result.colorPalette,
      );
      const resolvedSlots = resolveAvatarSlotAssets(response.result);
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

      // Give the outfit matching pants: color the leg zones so the 3D figure wears them too.
      const pantsColors = pickPantsColors(parsed.palette);
      outfitRef.current = { pantsBase: pantsColors.base, pantsAccent: pantsColors.accent };
      for (const legZone of ["left_leg_front", "right_leg_front", "left_leg_back", "right_leg_back"]) {
        addLayer({
          name: "Bukse",
          type: "paintLayerSet",
          zone: legZone,
          color: pantsColors.base,
          transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        });
      }

      // Then draw the real clothing: one texture for the top garment, one for the bottom, plus the motif.
      setAiPhase("Tegner klærne du beskrev… (kan ta opptil ett minutt)");
      const [top, bottom, hero] = await Promise.all([
        apiPost<{ imageUrl?: string }>("/ai/hero-image", { prompt: usedPrompt.slice(0, 600), kind: "garment-top" }),
        apiPost<{ imageUrl?: string }>("/ai/hero-image", { prompt: usedPrompt.slice(0, 600), kind: "garment-bottom" }),
        apiPost<{ imageUrl?: string }>("/ai/hero-image", { prompt: usedPrompt }),
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
        if (!topUrl && !bottomUrl) setAiError("Designet er klart, men selve motivet kunne ikke tegnes. Prøv «Lag skin» igjen.");
      }
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 429) {
        setAiError("AI-en er opptatt eller grensen er nådd. Prøv igjen om litt.");
      } else {
        setAiError("Noe gikk galt med AI-en. Prøv igjen, gjerne med en litt annen beskrivelse.");
      }
    } finally {
      generateLockRef.current = false;
      setAiLoading(false);
      setAiPhase("");
    }
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
          setUploadStatus("Sender antrekket rett til Roblox-kontoen din…");
          setUploadStatus((await directUpload(files)).msg);
        } else {
          openRobloxWithFiles(files);
          setUploadStatus(UPLOAD_DONE_MSG);
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
        setUploadStatus("Sender deg til betaling (10 kr for 3 opplastinger)…");
        const checkout = await apiPost<{ checkoutUrl?: string; error?: string }>("/payments/create-checkout-session");
        if (checkout.data.checkoutUrl) {
          window.location.href = checkout.data.checkoutUrl;
          return;
        }
        setUploadStatus(checkout.data.error ?? "Kunne ikke starte betaling. Prøv igjen.");
        return;
      }

      setUploadStatus("Noe gikk galt. Prøv igjen.");
    } catch {
      setUploadStatus("Noe gikk galt. Prøv igjen.");
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col items-center gap-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">My Skins</h1>
          <p className="text-lg text-slate-300">👇 Trykk på et bilde – så lager vi skinnet! ✨</p>
        </header>

        <section className="w-full">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {IDEAS.map((idea) => (
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
            />
          </div>
        </section>

        <section className="w-full space-y-4">
          {aiLoading ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 p-5 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-lg font-semibold">🎨 {aiPhase || "Lager skinnet ditt…"}</p>
              <p className="text-sm text-slate-300">Vent litt – se på figuren! 👀</p>
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
              {uploadBusy ? "Jobber…" : "🎁 Send til Roblox!"}
            </Button>
            {robloxMe?.configured ? (
              robloxMe.loggedIn ? (
                <p className="text-sm text-slate-300">
                  🎮 Logget inn som <span className="font-semibold">{robloxMe.name}</span> – antrekket sendes rett til kontoen din!{" "}
                  <button
                    type="button"
                    className="underline text-slate-400 hover:text-slate-200"
                    onClick={() => {
                      void apiPost("/auth/roblox/logout").then(() => setRobloxMe({ loggedIn: false, configured: true }));
                    }}
                  >
                    Logg ut
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
                  🎮 Logg inn med Roblox (send skins rett til kontoen din)
                </button>
              )
            ) : null}
            {skinStatus ? (
              <p className="text-sm text-slate-400">
                {skinStatus.paidCredits > 0
                  ? `⭐ ${skinStatus.paidCredits} opplastinger igjen`
                  : "10 kr gir 3 opplastinger (en voksen hjelper med betalingen)"}
              </p>
            ) : null}
            {uploadStatus ? <p className="text-sm text-emerald-400 text-center max-w-lg">{uploadStatus}</p> : null}
            {readyFiles ? (
              <button
                type="button"
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:border-emerald-400"
                onClick={() => openRobloxWithFiles(readyFiles)}
              >
                📥 Last ned filene på nytt (gratis – du har allerede betalt)
              </button>
            ) : null}
            {!hasDesign && !aiLoading ? <p className="text-sm text-slate-500">Trykk på et bilde øverst for å lage skinnet ditt! 👆</p> : null}
          </div>

          <details className="w-full rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-300">✏️ Skriv ditt eget skin (for store barn og voksne)</summary>
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
                placeholder="F.eks. «svart drage-hettegenser med røde flammer»"
                className="h-12 bg-slate-900 border-slate-700 text-base"
                disabled={aiLoading}
              />
              <Button type="submit" size="lg" className="h-12 px-6" disabled={aiLoading || !prompt.trim()}>
                <Sparkles className="mr-2 h-5 w-5" />
                Lag skin
              </Button>
            </form>
          </details>
        </section>
      </div>
    </div>
  );
}
