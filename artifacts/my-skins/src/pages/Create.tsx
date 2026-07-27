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

const STEPS = [
  { title: "1. Beskriv skinnet", text: "Skriv hva du vil ha i feltet under figuren – hva som helst. AI-en lager hele antrekket: overdel, bukse og t-skjorte-motiv." },
  { title: "2. Se det på figuren", text: "Hele antrekket dukker opp direkte på 3D-figuren. Dra for å rotere og se det fra alle sider." },
  { title: "3. Last opp til Roblox", text: "10 kr gir 3 opplastinger. Du får PNG-filer for overdel (Shirt), bukse (Pants) og t-skjorte, og Roblox sin opplastingsside åpnes – velg filene der." },
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
  const outfitRef = useRef<{ pantsBase: string; pantsAccent: string; heroUrl?: string } | null>(null);

  const { state, setAiPlanPreview, setAiAvatarPreview, deleteLayer, addLayer, applyAiPlan, setPaintSwatch } = useDesignStore();
  const hasDesign = state.layers.length > 0 || Boolean(state.baseColor);

  const refreshStatus = useCallback(async () => {
    try {
      setSkinStatus(await apiGet<SkinStatus>("/payments/skin-status"));
    } catch {
      /* ignore – status is informational */
    }
  }, []);

  // On mount: load free-count status and finish any payment we returned from.
  useEffect(() => {
    void refreshStatus();
    const params = new URLSearchParams(window.location.search);
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
            openRobloxWithFiles(pending);
            window.localStorage.removeItem(PENDING_SKIN_KEY);
            setUploadStatus(`Betaling godkjent – du har fått 3 opplastinger! ${UPLOAD_DONE_MSG}`);
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
  }, [refreshStatus]);

  const handleOverlayImageReady = useCallback(() => {
    setImageRenderNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!offscreenCanvasRef.current) offscreenCanvasRef.current = document.createElement("canvas");
    const offscreen = offscreenCanvasRef.current;
    const idHandle = window.setTimeout(() => {
      setPreviewTexture(renderDesignToCanvas(state, offscreen, { onOverlayImageReady: handleOverlayImageReady }));
    }, 20);
    return () => window.clearTimeout(idHandle);
  }, [handleOverlayImageReady, imageRenderNonce, state]);

  const generate = async () => {
    if (aiLoading || !prompt.trim()) return;
    setAiLoading(true);
    setAiError("");
    setUploadStatus("");
    setAiPhase("Lager designet…");
    try {
      const response = normalizeAiResponse(await aiGenerateDesign({ prompt, itemType: "classic_shirt", style: "AI velger", theme: prompt }));
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

      // Then draw the actual artwork described in the prompt and place it on the shirt.
      setAiPhase("Tegner motivet du beskrev… (kan ta opptil ett minutt)");
      const hero = await apiPost<{ imageUrl?: string }>("/ai/hero-image", { prompt });
      if (hero.status === 200 && hero.data.imageUrl) {
        outfitRef.current = { pantsBase: pantsColors.base, pantsAccent: pantsColors.accent, heroUrl: hero.data.imageUrl };
        addLayer({
          name: "AI-motiv",
          type: "imageLayer",
          zone: "front",
          image: hero.data.imageUrl,
          transform: { x: 0, y: 0, scale: 0.95, rotation: 0, opacity: 1 },
        });
      } else {
        setAiError("Designet er klart, men selve motivet kunne ikke tegnes. Prøv «Lag skin» igjen.");
      }
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 429) {
        setAiError("AI-en er opptatt eller grensen er nådd. Prøv igjen om litt.");
      } else {
        setAiError("Noe gikk galt med AI-en. Prøv igjen, gjerne med en litt annen beskrivelse.");
      }
    } finally {
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
    const pants = await renderPantsTexture({ base: pantsBase, accent: pantsAccent, motifUrl: outfit?.heroUrl });
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
        openRobloxWithFiles(files);
        setUploadStatus(UPLOAD_DONE_MSG);
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
          <h1 className="text-3xl font-bold tracking-tight">My Skins</h1>
          <p className="text-slate-400">Skriv hva du vil ha – AI-en lager skinnet på Roblox-figuren.</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3 w-full">
          {STEPS.map((step) => (
            <div key={step.title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="text-sm font-semibold mb-1">{step.title}</h2>
              <p className="text-xs text-slate-400 leading-relaxed">{step.text}</p>
            </div>
          ))}
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

        <section className="w-full space-y-3">
          <form
            className="flex flex-col sm:flex-row gap-2"
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
              {aiLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              {aiLoading ? (aiPhase || "Lager skin…") : "Lag skin"}
            </Button>
          </form>
          {aiError ? <p className="text-sm text-red-400">{aiError}</p> : null}

          <div className="flex flex-col items-center gap-2 pt-2">
            <Button size="lg" className="h-14 px-10 text-lg font-semibold" onClick={() => void uploadToRoblox()} disabled={!hasDesign || uploadBusy}>
              {uploadBusy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Upload className="mr-2 h-5 w-5" />}
              {uploadBusy ? "Jobber…" : "Last opp til Roblox"}
            </Button>
            {skinStatus ? (
              <p className="text-xs text-slate-400">
                {skinStatus.paidCredits > 0
                  ? `${skinStatus.paidCredits} opplastinger igjen`
                  : "10 kr gir 3 opplastinger til Roblox"}
              </p>
            ) : null}
            {uploadStatus ? <p className="text-sm text-emerald-400 text-center max-w-lg">{uploadStatus}</p> : null}
            {!hasDesign ? <p className="text-xs text-slate-500">Lag et skin med AI først, så kan du laste det opp.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
